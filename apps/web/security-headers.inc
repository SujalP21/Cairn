# Included into every location that needs them — see the note in nginx.conf
# about add_header not being inherited once a location declares its own.
#
# `always` makes these apply to error responses too, not just 2xx/3xx.
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# The app loads no third-party scripts, styles or frames. Vite inlines small
# assets as data: URIs, and connect-src stays open because the API origin is a
# build-time choice that varies per deployment.
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src *; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
