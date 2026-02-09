import { useState } from "react";
import { QrCode, Printer, Copy, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authService } from "@/lib/auth";
import QRCode from "qrcode";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://172.16.21.12:4000/api";

export function QRGenerator({ deviceId, deviceName }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const generateQR = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Generating QR for device:", deviceId);

      const response = await authService.fetchWithAuth(
        `${API_URL}/api/qr-tokens/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            deviceId: deviceId,
            expiresInHours: 87600,
          }),
        },
      );

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      // Check content type before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Received non-JSON response:", text.substring(0, 200));
        throw new Error(
          `Server returned ${response.status}: Expected JSON but got ${contentType || "unknown content type"}`,
        );
      }

      const data = await response.json();
      console.log("Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate QR code");
      }

      setQrData(data);

      // Generate QR code image
      const qrImageDataUrl = await QRCode.toDataURL(data.qrUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQrImageUrl(qrImageDataUrl);
      console.log("QR code generated successfully");
    } catch (error) {
      console.error("Generate QR error:", error);
      setError(error.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const printQR = () => {
    if (!qrImageUrl) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${deviceName}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
            }
            .container {
              text-align: center;
            }
            h1 {
              margin-bottom: 10px;
              font-size: 24px;
            }
            p {
              margin-bottom: 20px;
              color: #666;
            }
            img {
              max-width: 400px;
              height: auto;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${deviceName}</h1>
            <p>Scan to view PM History</p>
            <img src="${qrImageUrl}" alt="QR Code" />
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const copyLink = async () => {
    if (!qrData?.qrUrl) return;

    try {
      await navigator.clipboard.writeText(qrData.qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
      setError("Failed to copy link to clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4 mr-2" />
          Generate QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate QR Code</DialogTitle>
          <DialogDescription>
            Create a QR code for public access to {deviceName}&apos;s PM history
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!qrData ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  This will generate a permanent QR code for physical attachment
                  to the device. The QR code will not expire and can be scanned
                  anytime to view the device&apos;s PM history.
                </AlertDescription>
              </Alert>

              <Button
                onClick={generateQR}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Generate Permanent QR Code
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* QR Code Display */}
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <img src={qrImageUrl} alt="QR Code" className="w-64 h-64" />
              </div>

              {/* Info Banner */}
              <Alert>
                <AlertDescription className="text-center">
                  <strong>Permanent QR Code</strong> This QR code does not
                  expire. Print and attach it to the physical device for easy PM
                  history access.
                </AlertDescription>
              </Alert>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={printQR}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button onClick={copyLink} variant="secondary">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>

              {/* Link Preview */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Direct Link
                </Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs font-mono break-all">{qrData.qrUrl}</p>
                </div>
              </div>

              {/* Generate New Button */}
              <Button
                onClick={() => {
                  setQrData(null);
                  setQrImageUrl("");
                }}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate New QR Code
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
