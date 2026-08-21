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