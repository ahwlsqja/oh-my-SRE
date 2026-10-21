import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createReceiptMiddleware } from "./server/receipt-provider.mjs";
import { createEngineMiddleware } from "./server/engine-provider.mjs";

export default defineConfig({
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  plugins: [
    react(),
    {
      name: "local-receipt-provider",
      configureServer(server) {
        server.middlewares.use(
          createEngineMiddleware({
            path: process.env.OMS_ENGINE_PROJECTION_PATH,
            root: server.config.root,
            getPort: () => {
              const address = server.httpServer?.address();
              return typeof address === "object" ? address?.port : undefined;
            },
          }),
        );
        server.middlewares.use(
          createReceiptMiddleware({
            path: process.env.OMS_RECEIPT_PATH,
            root: server.config.root,
            getPort: () => {
              const address = server.httpServer?.address();
              return typeof address === "object" ? address?.port : undefined;
            },
          }),
        );
      },
      configurePreviewServer(server) {
        server.middlewares.use(
          createEngineMiddleware({
            path: process.env.OMS_ENGINE_PROJECTION_PATH,
            root: server.config.root,
            getPort: () => {
              const address = server.httpServer.address();
              return typeof address === "object" ? address?.port : undefined;
            },
          }),
        );
        server.middlewares.use(
          createReceiptMiddleware({
            path: process.env.OMS_RECEIPT_PATH,
            root: server.config.root,
            getPort: () => {
              const address = server.httpServer.address();
              return typeof address === "object" ? address?.port : undefined;
            },
          }),
        );
      },
    },
  ],
});
