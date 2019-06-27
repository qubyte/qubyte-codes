workflow "Publish Scheduled Posts" {
  resolves = ["npm run publish-scheduled"]
  on = "schedule(0/5 * * * *)"
}

action "npm install" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "install"
}

action "npm run publish-scheduled" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  needs = ["npm install"]
  args = "run publish-scheduled"
  secrets = ["GITHUB_TOKEN"]
}
