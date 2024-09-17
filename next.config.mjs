/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        GOOGLE_SEARCH_DEVELOPER_KEY: process.env.GOOGLE_SEARCH_DEVELOPER_KEY,
        GOOGLE_SEARCH_CX_ID: process.env.GOOGLE_SEARCH_CX_ID,
      },
};


