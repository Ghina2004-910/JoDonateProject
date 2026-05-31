export const uploadToCloudinary = async (fileUri: string): Promise<string> => {
  if (!fileUri || typeof fileUri !== "string") {
    throw new Error("Invalid file URI");
  }

  const data = new FormData();
  const filename = fileUri.split("/").pop() || "upload.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const ext = match?.[1]?.toLowerCase();
  const type =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  data.append("file", {
    uri: fileUri,
    name: filename,
    type,
  } as unknown as Blob);

  data.append("upload_preset", "jo_default");

  const response = await fetch("https://api.cloudinary.com/v1_1/dmjyeckc5/image/upload", {
    method: "POST",
    body: data,
  });

  const text = await response.text();
  let result: { secure_url?: string; error?: { message?: string } };
  try {
    result = JSON.parse(text) as { secure_url?: string; error?: { message?: string } };
  } catch {
    throw new Error("Invalid response from image server.");
  }

  if (!response.ok) {
    throw new Error(result.error?.message ?? `Upload failed (${response.status})`);
  }

  if (result.secure_url) {
    return result.secure_url;
  }

  throw new Error(result.error?.message ?? "Failed to upload image");
};
