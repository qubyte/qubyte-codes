workflow "Publish Scheduled Posts" {
  resolves = ["Publish Scheduled Posts: npm run publish-scheduled"]
  on = "schedule(0/15 * * * *)"
}

action "Publish Scheduled Posts: npm ci" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "ci"
}

action "Publish Scheduled Posts: npm run publish-scheduled" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  needs = ["Publish Scheduled Posts: npm ci"]
  args = "run publish-scheduled"
  secrets = ["NETLIFY_BUILD_HOOK_URL"]
}

workflow "Update Copyright Notice" {
  resolves = ["Update Copyright Notice: HTTP client"]
  on = "schedule(0 0 1 1 *)"
}

action "Update Copyright Notice: HTTP client" {
  uses = "swinton/httpie.action@8ab0a0e926d091e0444fcacd5eb679d2e2d4ab3d"
  args = ["POST", "$NETLIFY_BUILD_HOOK_URL"]
  secrets = ["NETLIFY_BUILD_HOOK_URL"]
}

workflow "Pull request" {
  on = "pull_request"
  resolves = ["Pull request: npm test", "Pull request: npm run lint"]
}

action "Pull request: opened or synchronize" {
  uses = "actions/bin/filter@3c0b4f0e63ea54ea5df2914b4fabf383368cd0da"
  args = "action 'opened|synchronize'"
}

action "Pull request: npm install" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "install --unsafe-perm"
  needs = ["Pull request: opened or synchronize"]
}

action "Pull request: npm ci" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "ci --unsafe-perm"
}

action "Pull request: npm test" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "test"
  needs = ["Pull request: npm ci"]
}

action "Pull request: npm run lint" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  needs = ["Pull request: npm ci"]
  args = "run lint"
}
