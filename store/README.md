# Samsung Apps TV: what to submit

Submitted through **Samsung Apps TV Seller Office** (https://seller.samsungapps.com/tv). Publishing on
the TV store usually needs Samsung's partner approval first; apply early.

- **Text, 33 languages:** `listing/<code>.json`, with `title`, `short` (≤ 80), `description` (≤ 4000) and
  `release_notes`. Paste each language into the matching language of the app's information page.
- **Images:** `images/`
  - `icon-512x423.png`, the same file as the app's `icon.png` (Samsung's TV icon size)
  - `icon-512.png`, if a square icon is asked for
  - `screenshots/*.png` 1920×1080
- **The app:** the `.wgt` from the GitHub Release (`vi-translator-tizen-tv-X.Y.Z.wgt`).

Check the current image sizes in Seller Office when you submit.

## Certificates

The store build needs a distributor certificate with the **Public** (partner) privilege level, which
Samsung issues once you are a partner. The ones in `C:\dev\vitranslator.app\tizen-tv\` are for your own
TVs (their DUIDs in `device-profile.xml`). Make the store certificate in Certificate Manager after
approval (you sign in with your Samsung account there), then update the four `TIZEN_*` secrets.

The app shows the HDMI input with the TV Window API (`tv.window`); check in Seller Office whether that
privilege needs partner level on the TV models you target.

## Answers

| Field | Answer |
| --- | --- |
| Category | Utilities (or Lifestyle) |
| Price | Free |
| Model years | 2018 and later |
| Privacy policy | https://vitranslator.app/privacy/ |
| Age rating | All ages |

## Test notes for Samsung QA

> VI Translator for Samsung TVs shows translated subtitles over a console's picture. The subtitles
> come from the free VI Translator app on a Windows, macOS or Linux PC on the same network
> (https://github.com/vi-translator/vi-translator-desktop/releases). To test:
> 1. Open the app: it shows a 6-digit code.
> 2. On the PC, start VI Translator, open *Show on → Connect a TV*, type the code, press
>    *Connect*. The TV appears on the PC within about 20 seconds.
> 3. The app shows the console's HDMI input full screen, with the translations of the English subtitles
>    on top. Press OK for the menu: *Input*, *Language*, *Disconnect*. Back closes the menu, or the app.
> A video of the whole flow: <add a link to an unlisted video>.
> No account or login is needed.
