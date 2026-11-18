#!/usr/bin/env bash
# Builds and signs build/vi-translator-tizen-tv-<VERSION>.wgt for a release (the release workflow
# runs it; it runs anywhere the Tizen Studio CLI is installed, to try it).
#
#   VERSION=1.2.3 \
#   TIZEN_AUTHOR_P12=<base64 of author.p12> TIZEN_AUTHOR_PASSWORD=<its password> \
#   TIZEN_DISTRIBUTOR_P12=<base64 of distributor.p12> TIZEN_DISTRIBUTOR_PASSWORD=<its password> \
#   tools/release.sh
#
# The certificates are the ones made in Certificate Manager (Samsung, TV): see "Releases" in the
# README. Without a distributor certificate it signs with the Tizen one that comes with the CLI,
# which a Samsung TV refuses: for trying the script only.
#
# TIZEN_STUDIO: where the Tizen Studio CLI is (default ~/tizen-studio).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() { echo "::error::$*" >&2; exit 1; }

V="${VERSION:-}"
# (a Tizen app's version: up to 255.255.65535)
echo "$V" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || fail "VERSION must look like 1.2.3 (got '$V')"
IFS=. read -r MAJOR MINOR PATCH <<< "$V"
{ [ "$MAJOR" -le 255 ] && [ "$MINOR" -le 255 ] && [ "$PATCH" -le 65535 ]; } || fail "a Tizen version goes up to 255.255.65535 (got $V)"

[ -n "${TIZEN_AUTHOR_P12:-}" ] || fail "TIZEN_AUTHOR_P12 is not set (the author certificate, author.p12, base64)"
[ -n "${TIZEN_AUTHOR_PASSWORD:-}" ] || fail "TIZEN_AUTHOR_PASSWORD is not set (the author certificate's password)"
if [ -n "${TIZEN_DISTRIBUTOR_P12:-}" ] && [ -z "${TIZEN_DISTRIBUTOR_PASSWORD:-}" ]; then
  fail "TIZEN_DISTRIBUTOR_PASSWORD is not set (the distributor certificate's password)"
fi

STUDIO="${TIZEN_STUDIO:-$HOME/tizen-studio}"
TIZEN="$STUDIO/tools/ide/bin/tizen"
[ -x "$TIZEN" ] || fail "no Tizen Studio CLI at $STUDIO (set TIZEN_STUDIO)"
export TIZEN_STUDIO="$STUDIO"

# the version from the tag
perl -0pi -e 's/(<widget\b[^>]*?\bversion=")[^"]*(")/${1}'"$V"'${2}/' config.xml
grep -q "version=\"$V\"" config.xml || fail "couldn't set the version in config.xml"

# the certificates, only for as long as it takes
keys="$(mktemp -d)"
PROFILE="vit-release-$$"
cleanup() {
  "$TIZEN" security-profiles remove -n "$PROFILE" > /dev/null 2>&1 || true
  rm -rf "$keys"
  # (the CLI's log has the certificates' passwords in it)
  rm -rf "${TIZEN_DATA:-$HOME/tizen-studio-data}/cli/logs"
}
trap cleanup EXIT
umask 077
printf '%s' "$TIZEN_AUTHOR_P12" | base64 -d > "$keys/author.p12" 2> /dev/null || fail "TIZEN_AUTHOR_P12 isn't base64"
args=(-n "$PROFILE" -a "$keys/author.p12" -p "$TIZEN_AUTHOR_PASSWORD" -f)
if [ -n "${TIZEN_DISTRIBUTOR_P12:-}" ]; then
  printf '%s' "$TIZEN_DISTRIBUTOR_P12" | base64 -d > "$keys/distributor.p12" 2> /dev/null || fail "TIZEN_DISTRIBUTOR_P12 isn't base64"
  args+=(-d "$keys/distributor.p12" -dp "$TIZEN_DISTRIBUTOR_PASSWORD")
else
  echo "::warning::no distributor certificate: signed with Tizen's, which Samsung TVs refuse"
fi
# (wrong passwords show only when signing: checked here first, for a clear error)
openssl pkcs12 -in "$keys/author.p12" -passin env:TIZEN_AUTHOR_PASSWORD -noout -legacy 2> /dev/null \
  || openssl pkcs12 -in "$keys/author.p12" -passin env:TIZEN_AUTHOR_PASSWORD -noout 2> /dev/null \
  || fail "the author certificate can't be opened with TIZEN_AUTHOR_PASSWORD"
if [ -f "$keys/distributor.p12" ]; then
  openssl pkcs12 -in "$keys/distributor.p12" -passin env:TIZEN_DISTRIBUTOR_PASSWORD -noout -legacy 2> /dev/null \
    || openssl pkcs12 -in "$keys/distributor.p12" -passin env:TIZEN_DISTRIBUTOR_PASSWORD -noout 2> /dev/null \
    || fail "the distributor certificate can't be opened with TIZEN_DISTRIBUTOR_PASSWORD"
fi
"$TIZEN" security-profiles add "${args[@]}" > /dev/null || fail "the Tizen CLI didn't take the certificates"
# On Linux the CLI keeps the passwords in the desktop's keyring, which a build machine hasn't got:
# no .pwd file is written, and signing says "Invalid password". The profile takes the password
# itself instead of a .pwd file's path. (The Tizen distributor's password is the public one it
# comes with.)
profiles="${TIZEN_DATA:-$HOME/tizen-studio-data}/profile/profiles.xml"
[ -f "$profiles" ] || fail "no Tizen security profiles at $profiles (set TIZEN_DATA)"
PROFILE="$PROFILE" AUTHOR_PW="$TIZEN_AUTHOR_PASSWORD" DIST_PW="${TIZEN_DISTRIBUTOR_PASSWORD:-tizenpkcs12passfordsigner}" \
  perl -0pi -e '
    sub esc { my $s = shift; $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g; $s =~ s/"/&quot;/g; $s }
    my ($name, $a, $d) = @ENV{qw(PROFILE AUTHOR_PW DIST_PW)};
    s{(<profile name="\Q$name\E">)(.*?)(</profile>)}{
      my ($open, $items, $close) = ($1, $2, $3);
      $items =~ s{(distributor="([01])"[^>]*?password=")([^"]*)(")}{
        -f $3 ? "$1$3$4" : $1 . esc($2 eq "0" ? $a : $d) . $4
      }ge;
      "$open$items$close"
    }se;
  ' "$profiles"
umask 022

node tools/build.js "$PROFILE"

out="build/vi-translator-tizen-tv-$V.wgt"
mv build/VITranslator.wgt "$out"
# signed: the author's signature and the distributor's
for f in author-signature.xml signature1.xml; do
  unzip -l "$out" | grep -q " $f\$" || fail "$out has no $f: not signed"
done
unzip -p "$out" config.xml | grep -q "version=\"$V\"" || fail "$out isn't version $V"
ls -l "$out"
