/**
 * Railway entry point.
 *
 * The Dockerfile already runs `npm install` at build time, so node_modules
 * should exist in the image before this ever runs. Earlier this file tried
 * to self-heal by running `npm install` again at container *startup* when
 * express couldn't be resolved. That fallback is what was actually causing
 * the crash loop: spawning npm inside the running container repeatedly hit
 * npm's "Exit handler never called!" bug and failed, Railway restarted the
 * container on failure, and it looped forever producing the same errors.
 *
 * If express is genuinely missing at runtime, that's almost always caused
 * by something outside the app itself (most commonly a Railway Volume
 * mounted on /app or a parent directory of node_modules, which wipes out
 * whatever the build produced). Retrying npm install can't fix that, so we
 * fail once with a clear message instead of looping.
 */
const appRoot = __dirname;
function canLoadExpress() {
  try {
    require.resolve("express", { paths: [appRoot] });
    return true;
  } catch {
    return false;
  }
}

if (!canLoadExpress()) {
  console.error(
    "Fatal: node_modules/express is missing at runtime even though the " +
    "Docker build installs it. This usually means something is overwriting " +
    "/app after the image is built - most commonly a Railway Volume mounted " +
    "on /app (or a parent of node_modules) instead of a narrow path like " +
    "/app/data. Check Settings > Volumes for this service and make sure the " +
    "mount path doesn't cover node_modules."
  );
  process.exit(1);
}

require("./server");