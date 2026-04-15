import type { NextConfig } from "next";
import path from "path";
import os from "os";

// Turbopack panics when the project lives inside a cloud-sync folder (Nutstore)
// because it canonicalizes symlinks and then lacks write permission on the
// resolved path. Redirect the build output to a stable local directory instead.
const nextConfig: NextConfig = {
  distDir: path.join(os.homedir(), ".next-dianxiaomi"),
};

export default nextConfig;
