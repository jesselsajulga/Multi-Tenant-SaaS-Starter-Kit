-- Grant SELECT privileges on Organization and User to app_user for recipient invitation lookups and relations
GRANT SELECT ON "Organization" TO app_user;
GRANT SELECT ON "User" TO app_user;
