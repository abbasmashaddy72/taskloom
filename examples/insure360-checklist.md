# Project: Insure360
> Current working checklist — initial task statuses have not yet been verified.

## List: Foundation
- [ ] T1 Push current code to Git | priority:high
  - [ ] Inspect current branch and working tree
  - [ ] Verify remote and credentials
  - [ ] Commit and push a recoverable baseline
- [ ] T2 Audit code using multiple analysis tools | priority:high
  - [ ] Identify applicable tools
  - [ ] Execute available analyzers
  - [ ] Record diagnostics and findings
- [ ] T3 Fix code formatting issues

## List: Quality before optimization
- [ ] T4 Check every application page for errors before optimization | priority:high
  - [ ] Audit routes and page registration
  - [ ] Verify each page in the browser
  - [ ] Record errors and regression baselines
- [ ] T5 Optimize code where required
  - [ ] Record performance baseline
  - [ ] Make targeted improvements
  - [ ] Compare results and rerun tests
- [ ] T6 Enable environment-aware logging and add required diagnostic logs
  - [ ] Enable detailed diagnostics for local environment
  - [ ] Avoid secrets and sensitive personal data in logs
  - [ ] Control high-volume logging
- [ ] T7 Remove deprecated, unused, and unnecessary code and files
- [ ] T8 Replace conflicting custom app() helper usage

## List: Framework upgrades
- [ ] T9 Upgrade Filament 3 to 4 to 5 | priority:high
  - [ ] Review plugins and version compatibility
  - [ ] Upgrade to Filament 4 and test
  - [ ] Upgrade to Filament 5 and test
- [ ] T10 Upgrade Laravel to 13 | priority:high
  - [ ] Audit PHP and package requirements
  - [ ] Perform upgrade
  - [ ] Verify application and tenant flows
