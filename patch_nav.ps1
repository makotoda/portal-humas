$html = Get-Content -Path "C:\Users\ASUS\Documents\portal-humas\index.html" -Raw

# 1. Update Nav.go
$html = $html -replace "(window\.scrollTo\(\{top:0,behavior:'instant'\}\);)", "`$1`n    window.dispatchEvent(new Event('scroll'));"

# 2. Update scroll listener
$searchScroll = "(?s)const bgOverlay = `\`$\('#bgOverlay'\);.*?bgOverlay\.style\.opacity = op;\s*\}"
$replaceScroll = @"
const bgOverlay = `$('#bgOverlay');
  if(bgOverlay) {
    const isHome = `$('#v-home') && `$('#v-home').classList.contains('aktif');
    if (!isHome) {
      bgOverlay.style.opacity = 0.85;
    } else {
      const maxScroll = 400;
      const op = Math.min(window.scrollY / maxScroll, 0.85);
      bgOverlay.style.opacity = op;
    }
  }
"@
$html = $html -replace $searchScroll, $replaceScroll

Set-Content -Path "C:\Users\ASUS\Documents\portal-humas\index.html" -Value $html -Encoding UTF8
Write-Host "Success"
