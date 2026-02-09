import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const SITE_URL = process.env.NEXTAUTH_URL || "http://localhost:8010";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // 항상 NEXTAUTH_URL (8010)로 리다이렉트
      // baseUrl이 잘못된 경우에도 올바른 URL 반환
      if (url.startsWith("/")) {
        return `${SITE_URL}${url}`;
      }
      // 이미 올바른 URL인 경우
      if (url.startsWith(SITE_URL)) {
        return url;
      }
      // localhost의 다른 포트를 8010으로 수정
      if (url.includes("localhost:8000") || url.includes("localhost:3000")) {
        return url.replace(/localhost:\d+/, "localhost:8010");
      }
      // 기본: SITE_URL로 리다이렉트
      return SITE_URL;
    },
    async session({ session, token }) {
      if (session?.user && token?.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // 최초 로그인 시 사용자 정보 저장
      if (account && user) {
        token.accessToken = account.access_token;
        token.email = user.email;
      }
      return token;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
});
