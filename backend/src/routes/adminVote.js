const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

async function getOpenVote(client = pool) {
  const voteRes = await client.query("SELECT * FROM votes WHERE status = 'open' ORDER BY id DESC LIMIT 1");
  return voteRes.rows[0] || null;
}

async function getOptions(voteId, client = pool) {
  const optsRes = await client.query(
    'SELECT id, label FROM vote_options WHERE vote_id = $1 ORDER BY sort_order ASC, id ASC',
    [voteId]
  );
  return optsRes.rows;
}

async function getResults(vote, options, client = pool) {
  if (vote.vote_type === 'thumbs') {
    const r = await client.query(
      `SELECT thumbs_choice, COUNT(*)::int as count FROM vote_responses
       WHERE vote_id = $1 AND abstained = FALSE AND thumbs_choice IS NOT NULL
       GROUP BY thumbs_choice`,
      [vote.id]
    );
    const results = { up: 0, down: 0 };
    r.rows.forEach(row => { results[row.thumbs_choice] = row.count; });
    return results;
  }
  const r = await client.query(
    `SELECT option_id, COUNT(*)::int as count FROM vote_responses
     WHERE vote_id = $1 AND abstained = FALSE AND option_id IS NOT NULL
     GROUP BY option_id`,
    [vote.id]
  );
  const counts = {};
  r.rows.forEach(row => { counts[row.option_id] = row.count; });
  return options.map(o => ({ id: o.id, label: o.label, count: counts[o.id] || 0 }));
}

async function summarize(vote, client = pool) {
  const options = await getOptions(vote.id, client);
  const results = await getResults(vote, options, client);
  const abstainRes = await client.query(
    'SELECT COUNT(*)::int as count FROM vote_responses WHERE vote_id = $1 AND abstained = TRUE',
    [vote.id]
  );
  const totalRes = await client.query(
    'SELECT COUNT(*)::int as count FROM vote_responses WHERE vote_id = $1',
    [vote.id]
  );
  return {
    id: vote.id,
    question: vote.question,
    vote_type: vote.vote_type,
    status: vote.status,
    enabled: vote.enabled,
    results_visible: vote.results_visible,
    ended_at: vote.ended_at,
    options: options.map(o => ({ id: o.id, label: o.label })),
    results,
    abstain_count: abstainRes.rows[0].count,
    total_responses: totalRes.rows[0].count
  };
}

// Full admin view: the current open vote (with live tallies + abstain
// count) and every past vote, most recently ended first.
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const openVote = await getOpenVote();
    const current = openVote ? await summarize(openVote) : null;

    const historyRes = await pool.query(
      `SELECT * FROM votes WHERE status = 'ended' ORDER BY ended_at DESC, id DESC`
    );
    const history = [];
    for (const v of historyRes.rows) {
      history.push(await summarize(v));
    }

    res.json({ current, history });
  } catch (err) {
    console.error('Admin get vote error:', err);
    res.status(500).json({ error: 'Failed to load vote' });
  }
});

// Update the current open vote. Editing the question text (or an existing
// option's label, when the option count and vote_type are unchanged) never
// touches results. Changing vote_type or the number of options is a
// structural change, so existing options and responses are wiped and
// rebuilt fresh.
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { question, vote_type, options, enabled, results_visible } = req.body;

    await client.query('BEGIN');

    const current = await getOpenVote(client);
    if (!current) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No open vote to update' });
    }
    const currentOpts = await getOptions(current.id, client);

    const nextVoteType = vote_type !== undefined ? vote_type : current.vote_type;
    if (nextVoteType !== 'multiple_choice' && nextVoteType !== 'thumbs') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'vote_type must be "multiple_choice" or "thumbs"' });
    }

    let structuralChange = nextVoteType !== current.vote_type;

    let cleanedOptions;
    if (nextVoteType === 'multiple_choice' && options !== undefined) {
      cleanedOptions = options.map(o => String(o).trim()).filter(Boolean);
      if (cleanedOptions.length < 2 || cleanedOptions.length > 8) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Provide between 2 and 8 options' });
      }
      if (cleanedOptions.length !== currentOpts.length) {
        structuralChange = true;
      }
    }

    if (structuralChange) {
      await client.query('DELETE FROM vote_responses WHERE vote_id = $1', [current.id]);
      await client.query('DELETE FROM vote_options WHERE vote_id = $1', [current.id]);
      if (nextVoteType === 'multiple_choice') {
        const opts = cleanedOptions && cleanedOptions.length ? cleanedOptions : ['Option 1', 'Option 2'];
        for (let i = 0; i < opts.length; i++) {
          await client.query(
            'INSERT INTO vote_options (vote_id, label, sort_order) VALUES ($1, $2, $3)',
            [current.id, opts[i], i]
          );
        }
      }
    } else if (nextVoteType === 'multiple_choice' && cleanedOptions !== undefined) {
      // Same option count — update labels in place by position so ids
      // (and their vote counts) are preserved.
      for (let i = 0; i < currentOpts.length; i++) {
        if (cleanedOptions[i] !== undefined && cleanedOptions[i] !== currentOpts[i].label) {
          await client.query('UPDATE vote_options SET label = $1 WHERE id = $2', [cleanedOptions[i], currentOpts[i].id]);
        }
      }
    }

    const updates = ['vote_type = $1'];
    const values = [nextVoteType];
    let idx = 1;
    if (question !== undefined) { idx++; updates.push(`question = $${idx}`); values.push(question); }
    if (enabled !== undefined) { idx++; updates.push(`enabled = $${idx}`); values.push(!!enabled); }
    if (results_visible !== undefined) { idx++; updates.push(`results_visible = $${idx}`); values.push(!!results_visible); }
    updates.push('updated_at = NOW()');
    idx++;
    values.push(current.id);

    await client.query(`UPDATE votes SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    await client.query('COMMIT');

    const refreshed = await getOpenVote();
    const state = await summarize(refreshed);
    res.json({ ...state, reset: structuralChange });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin update vote error:', err);
    res.status(500).json({ error: 'Failed to save vote' });
  } finally {
    client.release();
  }
});

// Zero out the tally (and every abstain record) on the current open vote,
// without touching the question, options, or on/off toggles.
router.post('/reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const current = await getOpenVote();
    if (!current) {
      return res.status(400).json({ error: 'No open vote to reset' });
    }
    await pool.query('DELETE FROM vote_responses WHERE vote_id = $1', [current.id]);
    const state = await summarize(current);
    res.json(state);
  } catch (err) {
    console.error('Admin reset vote error:', err);
    res.status(500).json({ error: 'Failed to reset results' });
  }
});

// Close the current open vote — it moves into history (read-only from then
// on) and a fresh blank vote is opened up for the admin to configure next.
router.post('/end', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await getOpenVote(client);
    if (!current) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No open vote to end' });
    }

    await client.query(
      `UPDATE votes SET status = 'ended', enabled = FALSE, ended_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [current.id]
    );
    await client.query(
      `INSERT INTO votes (question, vote_type, status, enabled, results_visible)
       VALUES ('', 'multiple_choice', 'open', FALSE, FALSE)`
    );

    await client.query('COMMIT');

    const openVote = await getOpenVote();
    const current_state = openVote ? await summarize(openVote) : null;
    const historyRes = await pool.query(
      `SELECT * FROM votes WHERE status = 'ended' ORDER BY ended_at DESC, id DESC`
    );
    const history = [];
    for (const v of historyRes.rows) {
      history.push(await summarize(v));
    }

    res.json({ current: current_state, history });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin end vote error:', err);
    res.status(500).json({ error: 'Failed to end vote' });
  } finally {
    client.release();
  }
});

// Show/hide a past vote's results on the public vote page.
router.patch('/history/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid vote ID' });
    if (typeof req.body.results_visible !== 'boolean') {
      return res.status(400).json({ error: 'results_visible must be a boolean' });
    }

    const result = await pool.query(
      `UPDATE votes SET results_visible = $1, updated_at = NOW() WHERE id = $2 AND status = 'ended' RETURNING *`,
      [req.body.results_visible, id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Past vote not found' });
    }

    const state = await summarize(result.rows[0]);
    res.json(state);
  } catch (err) {
    console.error('Admin set vote history visibility error:', err);
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});

module.exports = router;
