import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '라운지핏', description: '그룹수업 예약 서비스' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
