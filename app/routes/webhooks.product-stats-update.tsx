import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: { request: Request }) => {
  const { admin }: any = await authenticate.webhook(request);

  try {
    // Get all QR codes and calculate stats for each product
    const qrCodes = await db.qRCode.findMany({
      select: {
        productId: true,
        scans: true,
        createdAt: true,
        shop: true,
      },
    });

    // Group by product ID and calculate stats
    const productStats = new Map();

    qrCodes.forEach((qrCode) => {
      if (!productStats.has(qrCode.productId)) {
        productStats.set(qrCode.productId, {
          totalScans: 0,
          qrCodeCount: 0,
          recentScans: 0,
          shop: qrCode.shop,
        });
      }

      const stats = productStats.get(qrCode.productId);
      stats.totalScans += qrCode.scans;
      stats.qrCodeCount += 1;

      // Check if QR code was created in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (qrCode.createdAt >= thirtyDaysAgo) {
        stats.recentScans += qrCode.scans;
      }
    });

    // Update product metafields with the calculated stats
    for (const [productId, stats] of productStats) {
      const avgRating = Math.min(
        5,
        Math.max(1, Math.round(stats.totalScans / 10) + 1),
      );

      // Update product metafields
      await admin.graphql(
        `
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              metafields(first: 10) {
                edges {
                  node {
                    id
                    key
                    value
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
        {
          variables: {
            input: {
              id: productId,
              metafields: [
                {
                  namespace: "qrcode_stats",
                  key: "total_scans",
                  value: stats.totalScans.toString(),
                  type: "number_integer",
                },
                {
                  namespace: "qrcode_stats",
                  key: "avg_rating",
                  value: avgRating.toString(),
                  type: "number_integer",
                },
                {
                  namespace: "qrcode_stats",
                  key: "recent_scans",
                  value: stats.recentScans.toString(),
                  type: "number_integer",
                },
                {
                  namespace: "qrcode_stats",
                  key: "qr_code_count",
                  value: stats.qrCodeCount.toString(),
                  type: "number_integer",
                },
              ],
            },
          },
        },
      );
    }

    return json({ success: true, updatedProducts: productStats.size });
  } catch (error) {
    console.error("Error updating product stats:", error);
    return json({ error: "Failed to update product stats" }, { status: 500 });
  }
};
