import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-xl place-items-center px-4 text-center">
      <div className="chalkboard w-full px-6 py-12">
        <p className="font-display text-6xl font-extrabold">404</p>
        <p className="mt-3 font-hand text-xl text-[#dff3e8]">Trang này không có trong vở rồi.</p>
        <Link href="/" className="btn btn-gold mt-6">
          Về trang đầu
        </Link>
      </div>
    </main>
  );
}
