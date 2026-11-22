export const LIBRARY_OVERFLOW_RULE_SQL = `INSERT INTO source_rules(profileId,sourceId,minimumDurationSeconds,hideLivestreams,hideUpcomingPremieres,todayContributionLimit,mutedUntil,updatedAt,favorite)
    SELECT ?,?,240,1,1,2,?,?,0 WHERE
    (SELECT COUNT(*) FROM followed_channels c LEFT JOIN source_rules r ON r.profileId=c.profileId AND r.sourceId=c.id WHERE c.profileId=? AND COALESCE(r.mutedUntil,0)<=?) > ?
    ON CONFLICT(profileId,sourceId) DO NOTHING`;

export const SAVE_SOURCE_RULE_SQL = `INSERT INTO source_rules (profileId,sourceId,minimumDurationSeconds,hideLivestreams,hideUpcomingPremieres,todayContributionLimit,mutedUntil,updatedAt,favorite) SELECT ?,?,?,?,?,?,?,?,? WHERE ? > ? OR (SELECT COUNT(*) FROM followed_channels c LEFT JOIN source_rules r ON r.profileId=c.profileId AND r.sourceId=c.id WHERE c.profileId=? AND c.id<>? AND COALESCE(r.mutedUntil,0)<=?) < ?
     ON CONFLICT(profileId,sourceId) DO UPDATE SET minimumDurationSeconds=excluded.minimumDurationSeconds,hideLivestreams=excluded.hideLivestreams,hideUpcomingPremieres=excluded.hideUpcomingPremieres,todayContributionLimit=excluded.todayContributionLimit,mutedUntil=excluded.mutedUntil,updatedAt=excluded.updatedAt,favorite=excluded.favorite`;
