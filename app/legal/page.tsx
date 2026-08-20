import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yasal Bilgilendirme & Gizlilik - MultiLog",
};

export default function LegalPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-zinc-300">
      <Link
        href="/"
        className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors mb-8 inline-block"
      >
        ← Ana Sayfaya Dön
      </Link>

      <h1 className="text-3xl font-bold text-zinc-100 mb-8">
        Yasal Bilgilendirme ve Hizmet Şartları
      </h1>

      <div className="space-y-8 text-sm leading-relaxed">
        <section className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
          <h2 className="text-base font-semibold text-zinc-100 mb-2">
            1. Veri ve İçerik Sağlayıcı (TMDB)
          </h2>
          <p>
            MultiLog üzerinde sunulan tüm film/dizi meta verileri, afişler ve
            görseller{" "}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-amber-400"
            >
              TMDB
            </a>{" "}
            API&apos;si aracılığıyla sağlanmaktadır. Bu ürün TMDB API&apos;sini
            kullanır ancak TMDB tarafından onaylanmamıştır veya
            sertifikalandırılmamıştır.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">
            2. Gizlilik Politikası (Privacy Policy)
          </h2>
          <p className="mb-2">
            MultiLog, kullanıcı deneyimini sağlamak ve takip verilerini
            senkronize etmek amacıyla minimum düzeyde veri toplar:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 mb-3">
            <li>
              Hesap oluşturma esnasında sağlanan E-posta adresi ve Kullanıcı adı
            </li>
            <li>
              İzleme geçmişi, film/dizi puanlamaları ve oluşturulan listeler
            </li>
          </ul>
          <p>
            Bu veriler, kimlik doğrulama ve veri depolama hizmeti sunan{" "}
            <strong className="text-zinc-200">Supabase</strong> altyapısında
            güvenli bir şekilde saklanır. Verileriniz üçüncü taraflara satılmaz
            veya pazarlama amacıyla kullanılmaz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">
            3. Hesap ve Veri Silme
          </h2>
          <p>
            Hesabınızı ve MultiLog üzerinde saklanan tüm verilerinizi kalıcı
            olarak sildirmek için aşağıdaki iletişim adresi üzerinden
            geliştirici ile iletişime geçebilirsiniz. Talebiniz en kısa sürede
            işleme alınacaktır.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">
            4. Hizmet Kullanım Şartları
          </h2>
          <p className="mb-2">
            MultiLog hobi amaçlı geliştirilmiş kişisel bir takip platformudur.
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Hizmet olduğu gibi (&quot;as is&quot;) sunulmaktadır.</li>
            <li>
              Kullanıcılar platform içerisinde oluşturdukları içeriklerden
              kendileri sorumludur.
            </li>
            <li>Kötüye kullanım tespit edilen hesaplar durdurulabilir.</li>
          </ul>
        </section>

        <section className="border-t border-zinc-800 pt-6">
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">
            5. İletişim
          </h2>
          <p>
            Telif ihlali bildirimleri, veri talepleri veya genel sorularınız
            için{" "}
            <a
              href="mailto:contact@multilog.app"
              className="text-amber-400 underline"
            >
              contact@multilog.app
            </a>{" "}
            adresi üzerinden ulaşabilirsiniz.
          </p>
        </section>
      </div>
    </main>
  );
}
