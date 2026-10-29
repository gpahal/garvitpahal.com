# Deployment

Production runs on a Cloudflare Worker with static assets, Cloudflare Access in front of `/x` and `/api/x`, a production Convex deployment and the Worker's secrets in Infisical's `prod` environment.

## How a deploy runs

[Deploy](../.github/workflows/deploy.yml) is the only path to production. It ships `main` on every push and on a manual run from the Actions tab; a manual run on any other branch or tag fails before anything else runs, and re-running an older run ships that older commit. [Check](../.github/workflows/check.yml) builds `dist/` without secrets, then Deploy ([`deploy-worker.ts`](../scripts/deploy-worker.ts)):

1. Signs in to Infisical as a machine identity with a token GitHub mints for the run, and fetches the Worker's secrets from `prod`. It stops unless `/` holds exactly the [five secrets](#infisical), each set, so a mistake stops the deploy before either half ships.
2. Sets Convex's `OWNER_EMAIL` and `CONVEX_JWT_JWKS` from the Worker's `OWNER_EMAIL` and `CONVEX_JWT_PRIVATE_KEY` ([`convex-env.ts`](../scripts/convex-env.ts)), then pushes the Convex backend.
3. Uploads the build to the Worker, with the secrets in the same version.

The backend must stay compatible with the pages served until the upload finishes. To undo a deploy, revert the commit on `main` and push; `wrangler rollback` restores only the Worker, against the newer backend.

A secret changed in Infisical reaches the Worker and Convex only with the next deploy, so re-run Deploy after changing one (`gh workflow run deploy.yml --ref main`). Every deploy overwrites Convex's two settings and the Worker's five secrets, so change them only in Infisical. The upload never deletes a Worker secret: remove one with `pnpm exec wrangler secret delete <name> --env deploy`.

`pnpm build` runs without secrets. A build under `infisical run` writes the dev secrets into `dist/server/.dev.vars`, so never share that `dist/`.

## Setup

Do these once, and recheck them after account changes, since [Verify production](#verify-production) catches only some mistakes. After [First deploy](#first-deploy), run the production cancel check in [Puzzle solvers](puzzle-solvers.md#verification).

### Infisical

The project [`.infisical.yaml`](../.infisical.yaml) names, on Infisical's US Cloud (`https://app.infisical.com`), holds the Worker's secrets: `dev` for `pnpm dev` ([Running the private tools](../README.md#running-the-private-tools)) and `prod` for Deploy.

1. Keep the project's environments with the slugs `dev` and `prod`. Nothing reads any other.
2. In `prod`, at the root path `/`, add exactly these five secrets, without secret imports: Deploy refuses a missing, empty or extra name.
   - `OPENAI_API_KEY`.
   - `CONVEX_JWT_PRIVATE_KEY`: the JSON line `pnpm convex-jwt-key` prints, run once for production and never used in `dev`. It signs every Convex token, so it goes nowhere but Infisical, not even a file.
   - `ACCESS_TEAM_DOMAIN`: `<team>.cloudflareaccess.com`, a bare host name.
   - `ACCESS_AUD`: the Access application's AUD tag ([Cloudflare step 2](#cloudflare)).
   - `OWNER_EMAIL`: the only email allowed to use `/x`, the same as the Access policy's.
3. Under Access Control → Machine Identities, create an identity for Deploy. In its Authentication section, add OIDC Auth with these settings and remove any other method:
   - OIDC Discovery URL and Issuer: `https://token.actions.githubusercontent.com`.
   - Subject: the one GitHub gives the `production` environment's jobs. A repository created after 15 July 2026 has numeric IDs in it, which this prints once the repository exists:

     ```sh
     owner_id=$(gh api users/gpahal --jq .id)
     repo_id=$(gh api repos/gpahal/garvitpahal.com --jq .id)
     echo "repo:gpahal@$owner_id/garvitpahal.com@$repo_id:environment:production"
     ```

   - Audiences: `https://app.infisical.com`, which `OIDC_AUDIENCE` in [`deploy-worker.ts`](../scripts/deploy-worker.ts) requests, rather than GitHub's default, so a token minted for Infisical is good nowhere else.
   - Access Token TTL and Max TTL: `600` seconds, enough for one deploy.
4. Under the project's Access Control → Machine Identities, add the identity with the Viewer role, which only reads. Without custom roles it can read `dev` as well as `prod`.
5. Note the identity's ID and the `project-id` in `.infisical.yaml` for [GitHub step 2](#github).

GitHub mints the token only for a job in the `production` environment, which [GitHub step 3](#github) limits to `main`, so no other branch or fork can read `prod`. Should Deploy's sign-in fail with a subject error, compare the subject above with the `sub` GitHub documents for the repository ([OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc)).

### Convex

Create the project in the Convex dashboard if `pnpm convex-dev` has not, then configure its Production deployment. Leave its environment variables to Deploy, which sets `OWNER_EMAIL` and `CONVEX_JWT_JWKS` before every push.

1. Under Settings → Deploy keys, create a production deploy key for GitHub's `CONVEX_DEPLOY_KEY`.
2. Under Settings → Usage Limits, give Function calls a daily warning threshold below the plan's included calls and no disable threshold: refused calls count too, so a flood of them should warn rather than disable the deployment. On a paid plan, also set a spending limit under the team's Settings → Billing ([usage limits](https://docs.convex.dev/production/usage-limits), [spending limits](https://docs.convex.dev/dashboard/teams/teams#spending-limits)).

### Cloudflare

The account is on the Workers Free plan: 10 ms of CPU per request, which bounds the pictures puzzle extraction accepts ([`image-limit.ts`](../src/lib/x/puzzle-solvers/vision/image-limit.ts)).

1. Deploy creates the Worker `garvitpahal-com`, with its secrets, on its first run. Afterwards, attach `garvitpahal.com` under the Worker's Settings → Domains & Routes; the Access application of step 2 must already cover it. Leave Settings → Builds unconnected and Settings → Variables and Secrets to Deploy.
2. Under Zero Trust → Access → Applications, create one self-hosted application with the destinations `garvitpahal.com/x`, `garvitpahal.com/x/*`, `garvitpahal.com/api/x` and `garvitpahal.com/api/x/*`. A `/*` destination does not match the bare path, and one application gives every forwarded JWT the AUD the Worker checks.
   - The policy allows a single email, the same as `OWNER_EMAIL`. Allow only login methods that verify the email, such as One-time PIN or Google: the Worker trusts the token's `email` claim.
   - Keep the default session duration, HTTP Only on and SameSite at Lax or Strict. [`token.ts`](../src/pages/api/x/token.ts) records the accepted script-injection risk.
   - Before attaching another hostname to the Worker, add the same four destinations for it.
3. Under SSL/TLS → Edge Certificates, enable HSTS with a non-zero max age. [`public/_headers`](../public/_headers) leaves HSTS to the zone.
4. Under My Profile → API Tokens, create a token with **Account → Workers Scripts → Edit**, restricted to this account, for GitHub's `CLOUDFLARE_API_TOKEN`. Note the account ID for `CLOUDFLARE_ACCOUNT_ID`.
5. Under Web Analytics, add `garvitpahal.com` and, under Manage site, choose the JS snippet installation: [`layout.astro`](../src/layouts/layout.astro) embeds the beacon, and automatic injection would add a second one. Note the token in the snippet for `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`; without it the build embeds no beacon and the CSP allows none.

### GitHub

The repository is public: on a free personal account, rulesets, environment branch limits and secret scanning work only on public repositories. Each step gives the settings page, then the `gh` commands that do the same from the repository root, signed in as the owner, in the shell where step 1 set `repo`. Finish the steps before the first push to `main`, since that push deploys.

1. Create the repository with only squash merges allowed.
   - In the UI, at <https://github.com/new>, create the public repository `garvitpahal.com` with no README, licence or `.gitignore`, then run `git remote add origin git@github.com:gpahal/garvitpahal.com.git`. Set the description and website with the gear beside About on the repository page. Under Settings → General, clear Wikis and Projects; under Pull Requests, allow only squash merging, with the default message "Pull request title and description", and tick "Always suggest updating pull request branches" and "Automatically delete head branches".
   - With `gh`:

     ```sh
     repo=gpahal/garvitpahal.com
     gh repo create "$repo" --public --source . --remote origin --disable-wiki \
       --description 'My personal website' --homepage https://garvitpahal.com
     gh repo edit "$repo" --enable-projects=false --enable-merge-commit=false --enable-rebase-merge=false \
       --enable-squash-merge --squash-merge-commit-message pr-title-description \
       --delete-branch-on-merge --allow-update-branch
     ```

2. Add the variables: the production Convex URL, the Cloudflare account ID and Web Analytics token, and the Infisical project and identity IDs ([Infisical step 5](#infisical)). Then add `ACCESS_TEAM_DOMAIN`, the same value as in Infisical's `prod`, as a repository secret, so the logs mask it: only [Verify production](#verify-production) reads it, from a job without an environment.
   - In the UI, under Settings → Secrets and variables → Actions → Variables, add each variable with New repository variable; under Secrets, add `ACCESS_TEAM_DOMAIN` with New repository secret.
   - With `gh`:

     ```sh
     gh variable set PUBLIC_CONVEX_URL --repo "$repo" --body 'https://<deployment>.convex.cloud'
     gh variable set CLOUDFLARE_ACCOUNT_ID --repo "$repo" --body '<account-id>'
     gh variable set PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN --repo "$repo" --body '<web-analytics-token>'
     gh variable set INFISICAL_PROJECT_ID --repo "$repo" --body '<project-id>'
     gh variable set INFISICAL_IDENTITY_ID --repo "$repo" --body '<identity-id>'
     gh secret set ACCESS_TEAM_DOMAIN --repo "$repo"
     ```

3. Create the `production` environment, limit it to `main` and add the secrets `CONVEX_DEPLOY_KEY` and `CLOUDFLARE_API_TOKEN`. The branch limit keeps these secrets and Infisical's `prod` from every other branch, including one that edits a workflow.
   - In the UI, under Settings → Environments → New environment, name it `production`. Set Deployment branches and tags to Selected branches and tags and add the branch rule `main`, then add each secret under Environment secrets.
   - With `gh`, where `gh secret set` without `--body` prompts for the value and so keeps it out of shell history:

     ```sh
     gh api -X PUT "repos/$repo/environments/production" \
       -F 'deployment_branch_policy[protected_branches]=false' \
       -F 'deployment_branch_policy[custom_branch_policies]=true'
     gh api -X POST "repos/$repo/environments/production/deployment-branch-policies" -f name=main -f type=branch
     gh secret set CONVEX_DEPLOY_KEY --repo "$repo" --env production
     gh secret set CLOUDFLARE_API_TOKEN --repo "$repo" --env production
     ```

   Either way, `gh api "repos/$repo/environments/production/deployment-branch-policies" --jq '.branch_policies[].name'` must print `main` alone.

4. Enable secret scanning, push protection and Dependabot alerts, but not Dependabot security updates: npm dependencies are updated by hand with `pnpm update` (and `pnpm update --latest '@gpahal/*'`, since a `^0.0.x` range never moves), which `minimumReleaseAge` in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) holds back three days. [Dependabot](../.github/dependabot.yml) updates the actions.
   - In the UI, under Settings → Advanced Security (Code security on older layouts), enable Dependabot alerts, secret scanning and push protection, and leave Dependabot security updates disabled.
   - With `gh`:

     ```sh
     gh repo edit "$repo" --enable-secret-scanning --enable-secret-scanning-push-protection
     gh api -X PUT "repos/$repo/vulnerability-alerts"
     gh api -X DELETE "repos/$repo/automated-security-fixes"
     ```

5. Add one ruleset, `main`, on the default branch with no bypass list, so every change reaches `main` as a squash-merged pull request that passed `check`. Create it with enforcement disabled and activate it in step 7: it would refuse the first push, whose history holds unsigned commits and whose new branch has no `check` status yet.
   - In the UI, under Settings → Rules → Rulesets → New ruleset → New branch ruleset, name it `main`, set Enforcement status to Disabled and add the target Include default branch. Tick Restrict deletions, Require linear history, Require signed commits, Require a pull request before merging (no required approvals, allowed merge method Squash), Require status checks to pass with the check `check` from GitHub Actions, and Block force pushes.
   - With `gh`, where app 15368 is GitHub Actions:

     ```sh
     echo '{"name": "main", "target": "branch", "enforcement": "disabled",
       "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"], "exclude": []}},
       "bypass_actors": [],
       "rules": [{"type": "deletion"}, {"type": "non_fast_forward"},
         {"type": "required_linear_history"}, {"type": "required_signatures"},
         {"type": "pull_request", "parameters": {"allowed_merge_methods": ["squash"],
           "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
           "require_code_owner_review": false, "require_last_push_approval": false,
           "required_review_thread_resolution": false}},
         {"type": "required_status_checks", "parameters": {
           "strict_required_status_checks_policy": false,
           "required_status_checks": [{"context": "check", "integration_id": 15368}]}}]}' |
       gh api -X POST "repos/$repo/rulesets" --input -
     ```

6. Require actions pinned to a full-length commit SHA, give workflow tokens read access only and hold every outside contributor's pull request for approval before its install scripts run.
   - In the UI, under Settings → Actions → General, keep Allow all actions and reusable workflows and tick Require actions to be pinned to a full-length commit SHA. Under Approval for running fork pull request workflows from contributors, choose Require approval for all external contributors. Under Workflow permissions, choose Read repository contents and packages permissions and clear Allow GitHub Actions to create and approve pull requests.
   - With `gh`:

     ```sh
     gh api -X PUT "repos/$repo/actions/permissions" -F enabled=true -f allowed_actions=all -F sha_pinning_required=true
     gh api -X PUT "repos/$repo/actions/permissions/workflow" \
       -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
     gh api -X PUT "repos/$repo/actions/permissions/fork-pr-contributor-approval" \
       -f approval_policy=all_external_contributors
     ```

7. Push with `git push -u origin main`, which starts Deploy, then activate the ruleset of step 5. In the UI, set its Enforcement status to Active; with `gh`:

   ```sh
   id=$(gh api "repos/$repo/rulesets" --jq '.[] | select(.name == "main") | .id')
   gh api -X PUT "repos/$repo/rulesets/$id" -f enforcement=active
   ```

   From then on, `main` changes only through pull requests, and Deploy runs on each merge. If Infisical is not set up yet, Deploy stops at "Fetch the Worker's secrets from Infisical" before either half ships; without a Convex deploy key it stops at "Deploy Convex", but a Cloudflare problem stops it only at "Deploy the Worker", after the backend has shipped.

### OpenAI

Under Organization settings → Limits → Spend, set a monthly limit with **Enforce a hard limit** and an alert below it. Only the hard limit bounds the bill, with some lag ([spend limits](https://developers.openai.com/api/docs/guides/spend-limits)); the [puzzle-read budget](convex.md#rate-limits) caps calls, not dollars.

### First deploy

Unless the push in [GitHub step 7](#github) already deployed, run **Deploy** with `gh workflow run deploy.yml --ref main` (or from the Actions tab). Then attach the domain ([Cloudflare step 1](#cloudflare)) and run **Verify production** with `gh workflow run verify-production.yml`; it fails until the domain is attached.

## Adding a server secret

A secret the Worker reads needs all of these. [`wrangler-config.test.ts`](../checks/wrangler-config.test.ts) holds the `envField`s, `WORKER_SECRETS` and `wrangler.jsonc` to one list, and Deploy fails until `prod` holds exactly that list.

1. An `envField` in [`astro.config.ts`](../astro.config.ts) with `context: 'server'`, `access: 'secret'` and `optional: true`, since prerendering runs without it. Check it per request.
2. Its name in `WORKER_SECRETS` ([`deploy-worker.ts`](../scripts/deploy-worker.ts)) and in `env.deploy.secrets.required` in [`wrangler.jsonc`](../wrangler.jsonc). If `pnpm dev` reads it, also in `env.dev.secrets.required` and in `DEV_SECRETS` in the check.
3. A value in Infisical's `prod` environment, and in `dev` if `pnpm dev` reads it. Then re-run Deploy.

A setting Convex reads comes from a Worker secret through `convexEnvFile` in [`convex-env.ts`](../scripts/convex-env.ts). A `PUBLIC_*` value takes an `envField` with `context: 'client'` and `access: 'public'`, a [`.env.development`](../.env.development) line for the dev deployment and a GitHub variable passed to the build step in [`check.yml`](../.github/workflows/check.yml). A Worker setting that is not secret goes in `vars` in `wrangler.jsonc`, under `env.dev` for `pnpm dev` and `env.deploy` for production.

## Rotating the Convex token key

Rotate at once if the private key may have leaked: whoever holds it can sign in as the owner ([Authentication](convex.md#authentication)).

1. Run `pnpm convex-jwt-key` locally for a new private key.
2. Replace `CONVEX_JWT_PRIVATE_KEY` in Infisical's `prod` environment and re-run Deploy. It sets Convex's `CONVEX_JWT_JWKS` to trust the new key alone before the Convex push, so the old key stops working at once, and the Worker signs with the new key once its upload finishes.

Until then, an open Agenda tab says its sign-in keys do not match; once they match, Try again reconnects it with its drafts intact. Rotate the local key the same way in Infisical's `dev` environment, then run `pnpm convex-dev-set-env` and restart `pnpm dev`.

## Verify production

[Verify production](../.github/workflows/verify-production.yml) runs after every deploy and monthly; run it from the Actions tab after changing account settings. It checks that signed-out requests to `/x`, `/x/agenda`, `/api/x` and `/api/x/token` meet the Access login of the team the `ACCESS_TEAM_DOMAIN` repository secret names ([`verify-access.ts`](../scripts/verify-access.ts)), and that the home page answers 200 with a CSP naming the `PUBLIC_CONVEX_URL` socket and a non-zero HSTS `max-age`. GitHub can disable scheduled runs after 60 days without repository activity, so a missing run is not a pass.

## Logs to watch

Each event is a JSON log line's `event` field. Read Convex's with `pnpm exec convex logs --prod` and the Worker's in Workers Logs or with `pnpm exec wrangler tail`. `<route>` is `token` or `puzzle-solvers`, and `<puzzle>` is `sudoku` or `ken-ken`.

| Event | Fix |
| --- | --- |
| `auth.not_owner` (Convex) | Re-run Deploy, which sets Convex's `OWNER_EMAIL` from the Worker's, or locally run `pnpm convex-dev-set-env` |
| `auth.owner_email_unset` (Convex) | Re-run Deploy, or locally run `pnpm convex-dev-set-env`; until then every call is refused |
| `routines.delete_resumed` (Convex) | Repeats mean `routines:drainBatch` keeps failing: look for its errors |
| `<route>.access_refused` at error level | By `reason`: for `no_access_jwt`, cover the path in Access without a Bypass policy ([Cloudflare step 2](#cloudflare)); for `claim_aud`, fix `ACCESS_AUD` in Infisical's `prod` and re-run Deploy; for `claim_iss` or `ERR_JWKS_NO_MATCHING_KEY`, do the same for `ACCESS_TEAM_DOMAIN`; for `malformed_claims`, allow only the owner's email login. Any other reason is a forged or corrupted token, and an expired session logs at info level |
| `<route>.not_owner` | Make the Access policy's email and `OWNER_EMAIL` in Infisical's `prod` match, then re-run Deploy |
| `<route>.auth_unavailable` | With `cause: misconfigured`, fix the Worker secret `message` names in Infisical's `prod` and re-run Deploy. With `cause: outage`, the Access certificates were unreachable; if it lasts, check that `ACCESS_TEAM_DOMAIN` names a team |
| `rate_limit.unavailable` | With `cause: misconfigured`, fix the setting `message` names: the `PUBLIC_CONVEX_URL` variable, or re-run Deploy for a `CONVEX_JWT_JWKS` that does not trust the Worker's key or a mismatched `OWNER_EMAIL`. With `cause: outage`, Convex was unreachable |
| `vision.not_configured` | Set `OPENAI_API_KEY` in Infisical's `dev` and restart `pnpm dev` (`pnpm dev:public` never reads it); Deploy refuses a `prod` without it |
| `vision.upstream_failed` | For `failure: account_rejected`, fix `OPENAI_API_KEY` in Infisical's `prod` and re-run Deploy, or fix the [spend limit](#openai); an invalid key shows only here, after admissions are spent. A lasting `model_failed`, or a run of `model_rejected` on ordinary photos, means OpenAI or picture preparation broke |
| `vision.truncated` | With `reason: max_output_tokens`, the output budget ran out: raise `MAX_TOKENS` in [`openai-exchange.ts`](../src/lib/x/puzzle-solvers/vision/server/openai-exchange.ts) or lower the model's `effort` in the puzzle's `server/extraction.ts`. More tokens do not help any other reason |
| `vision.malformed_reply`, `<puzzle>.uninterpretable` | A run of them means the Responses API changed or the model or prompt regressed |
| `<route>.unexpected_error`, `<puzzle>.unexpected_error` | A bug: `message` says what |
| `auth.dev_only_unverified_owner_token` | The unverified dev sign-in reached a build ([Authentication](convex.md#authentication)) |

## Backups

Nothing schedules or verifies backups. Deleting a routine permanently deletes its logs, so export production before destructive work:

```sh
mkdir -p ~/backups
pnpm exec convex export --prod --path ~/backups/garvitpahal-$(date +%F).zip
```

Without `--prod` it exports the deployment `CONVEX_DEPLOYMENT` in `.env.local` selects. Keep snapshots out of the repo and somewhere secure.
