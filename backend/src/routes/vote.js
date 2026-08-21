const express = require('express');
const { pool } = require('../db');
const { optionalAuth, authenticateToken } = require('../middleware/auth');

const router = express.Router();

async function getOpenVote() {
  const voteRes = await pool.query("SELECT * FROM votes WHERE status = 'open' ORDER BY id DESC LIMIT 1");
  return voteRes.rows[0] || null;
}

async function getOptions(voteId) {
  const optsRes = await pool.query(
    'SELECT id, label FROM vote_options WHERE vote_id = $1 ORDER BY sort_order ASC, id ASC',
    [voteId]
  );
  return optsRes.rows;
}

async function getResults(vote, options) {
  if (vote.vote_type === 'thumbs') {
    const r = await pool.query(
      `SELECT thumbs_choice, COUNT(*)::int as count FROM vote_responses
       WHERE vote_id = $1 AND abstained = FALSE AND thumbs_choice IS NOT NULL
       GROUP BY thumbs_choice`,
      [vote.id]
    );
    const results = { up: 0, down: 0 };
    r.rows.forEach(row => { results[row.thumbs_choice] = row.count; });
    return results;
  }
  const r = await pool.query(
    `SELECT option_id, COUNT(*)::int as count FROM vote_responses
     WHERE vote_id = $1 AND abstained = FALSE AND option_id IS NOT NULL
     GROUP BY option_id`,
    [vote.id]
  );
  const counts = {};
  r.rows.forEach(row => { counts[row.option_id] = row.count; });
  return options.map(o => ({ id: o.id, label: o.label, count: counts[o.id] || 0 }));
}

// Public: the current open vote (question/options/my response, plus results
// if the admin made them public) and any ended votes the admin chose to
// publish, most recently ended first. Works for logged-out visitors too.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const openVote = await getOpenVote();
    let current = null;
    if (openVote) {
      const options = await getOptions(openVote.id);
      current = {
        id: openVote.id,
        question: openVote.question,
        vote_type: openVote.vote_type,
        enabled: openVote.enabled,
        results_visible: openVote.results_visible,
        options: options.map(o => ({ id: o.id, label: o.label }))
      };
      if (req.user) {
        const myRes = await pool.query(
          'SELECT option_id, thumbs_choice, abstained FROM vote_responses WHERE vote_id = $1 AND user_id = $2',
          [openVote.id, req.user.id]
        );
        current.my_response = myRes.rows[0] || null;
      }
      if (openVote.results_visible) {
        current.results = await getResults(openVote, options);
      }
    }

    const historyRes = await pool.query(
      `SELECT * FROM votes WHERE status = 'ended' AND results_visible = TRUE ORDER BY ended_at DESC, id DESC`
    );
    const history = [];
    for (const v of historyRes.rows) {
      const options = await getOptions(v.id);
      history.push({
        id: v.id,
        question: v.question,
        vote_type: v.vote_type,
        ended_at: v.ended_at,
        options: options.map(o => ({ id: o.id, label: o.label })),
        results: await getResults(v, options)
      });
    }

    res.json({ current, history });
  } catch (err) {
    console.error('Get vote error:', err);
    res.status(500).json({ error: 'Failed to load vote' });
  }
});

// Cast (or change) a vote on the current open vote. Requires login.
router.post('/respond', authenticateToken, async (req, res) => {
  try {
    const vote = await getOpenVote();
    if (!vote || !vote.enabled) {
      return res.status(400).json({ error: 'Voting is not currently open' });
    }

    let option_id = null;
    let thumbs_choice = null;

    if (vote.vote_type === 'thumbs') {
      const { thumbs } = req.body;
      if (thumbs !== 'up' && thumbs !== 'down') {
        return res.status(400).json({ error: 'thumbs must be "up" or "down"' });
      }
      thumbs_choice = thumbs;
    } else {
      const optionId = parseInt(req.body.option_id);
      if (isNaN(optionId)) {
        return res.status(400).json({ error: 'option_id is required' });
      }
      const check = await pool.query(
        'SELECT id FROM vote_options WHERE id = $1 AND vote_id = $2',
        [optionId, vote.id]
      );
      if (!check.rows.length) {
        return res.status(400).json({ error: 'Invalid option' });
      }
      option_id = optionId;
    }

    await pool.query(
      `INSERT INTO vote_responses (vote_id, user_id, option_id, thumbs_choice, abstained, updated_at)
       VALUES ($1, $2, $3, $4, FALSE, NOW())
       ON CONFLICT (vote_id, user_id)
       DO UPDATE SET option_id = $3, thumbs_choice = $4, abstained = FALSE, updated_at = NOW()`,
      [vote.id, req.user.id, option_id, thumbs_choice]
    );

    res.json({ message: 'Vote recorded' });
  } catch (err) {
    console.error('Vote respond error:', err);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

// Decline to vote on the current open vote. Recorded for the admin view
// only — never counted in the public results, and never shown to this
// user again for this round.
router.post('/abstain', authenticateToken, async (req, res) => {
  try {
    const vote = await getOpenVote();
    if (!vote) {
      return res.status(400).json({ error: 'No vote is currently open' });
    }

    await pool.query(
      `INSERT INTO vote_responses (vote_id, user_id, option_id, thumbs_choice, abstained, updated_at)
       VALUES ($1, $2, NULL, NULL, TRUE, NOW())
       ON CONFLICT (vote_id, user_id)
       DO UPDATE SET option_id = NULL, thumbs_choice = NULL, abstained = TRUE, updated_at = NOW()`,
      [vote.id, req.user.id]
    );
    res.json({ message: 'Recorded' });
  } catch (err) {
    console.error('Vote abstain error:', err);
    res.status(500).json({ error: 'Failed to record' });
  }
});

module.exports = router;
