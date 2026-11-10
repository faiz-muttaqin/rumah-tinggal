abi <abi/4.0>,
include <tunables/global>

# Ubuntu 24.04 restricts unprivileged user namespaces by executable profile.
# Allow Chromium's own namespace sandbox for this root-owned binary only.
profile rumah-shared-chromium /opt/rumah-shared-browser/chromium/chrome flags=(unconfined) {
  userns,
}
