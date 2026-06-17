const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

async function test() {
    const s3 = new S3Client({
        region: "us-east-1",
        endpoint: "http://127.0.0.1:9000",
        credentials: {
            accessKeyId: "minioadmin",
            secretAccessKey: "minioadmin",
        },
        forcePathStyle: true,
    });

    const command = new PutObjectCommand({
        Bucket: "synergisuite-resources",
        Key: "test-file.txt",
        ContentType: "text/plain",
    });

    try {
        const url = await getSignedUrl(s3, command, { expiresIn: 300 });
        console.log("Presigned URL:", url);

        const res = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "text/plain",
            },
            body: "Hello world",
        });

        console.log("Upload response status:", res.status);
        console.log("Upload response body:", await res.text());
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
