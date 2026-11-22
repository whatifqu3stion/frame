/** Monotonic checkpoints, isolated by profile and explicit session run. */
export const READ_SESSION_RUN_SQL = "SELECT runId,consumedSeconds,ended,finishVideoId,lastVideoId FROM session_runs WHERE profileId=? AND sessionId=?";
export const SAVE_SESSION_RUN_SQL = `INSERT INTO session_runs(profileId,sessionId,runId,consumedSeconds,ended,finishVideoId,lastVideoId)
  SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM queues WHERE profileId=? AND id=?)
  ON CONFLICT(profileId,sessionId) DO UPDATE SET
    lastVideoId=CASE WHEN excluded.consumedSeconds>=session_runs.consumedSeconds THEN excluded.lastVideoId ELSE session_runs.lastVideoId END,
    consumedSeconds=MAX(session_runs.consumedSeconds,excluded.consumedSeconds),
    ended=MAX(session_runs.ended,excluded.ended),
    finishVideoId=CASE WHEN MAX(session_runs.ended,excluded.ended)=1 THEN NULL ELSE COALESCE(session_runs.finishVideoId,excluded.finishVideoId) END
  WHERE session_runs.runId=excluded.runId`;
export const RESET_SESSION_RUN_SQL = `INSERT INTO session_runs(profileId,sessionId,runId) VALUES (?,?,1)
  ON CONFLICT(profileId,sessionId) DO UPDATE SET runId=runId+1,consumedSeconds=0,ended=0,finishVideoId=NULL,lastVideoId=NULL`;
