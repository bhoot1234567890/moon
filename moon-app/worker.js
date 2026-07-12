// moon-app — reverse proxy serving the Moon Phase 3D app on moon.chaitanyamalhotra.com.
// Origin is the standalone moon-phase-3d Pages project.
const ORIGIN = "moon-phase-3d.pages.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = ORIGIN;
    url.protocol = "https:";
    url.port = "";
    return fetch(new Request(url, request));
  },
};
