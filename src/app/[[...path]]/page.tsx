import { ProviderSearch } from "@/components/provider-search";
import { ProviderTitlePage, ProviderWatchPage } from "@/components/provider-pages";
import {
  OfficialStreamCards,
  OfficialStreamPage,
} from "@/components/official-streams";
import { WatchablePage, OpenCinemaPage } from "@/components/watchable";
import { notFound, redirect } from "next/navigation";
import { Home } from "@/components/home";
import { SearchCatalog } from "@/components/search";
import {
  AuthPage,
  PremiumPage,
  AccountPage,
  PageHeading,
} from "@/components/account-pages";
import {
  TitlePage,
  CommunityPage,
  WatchPage,
} from "@/components/content-pages";
import { InfoPage, Leaderboard, PublicProfile } from "@/components/info-pages";
import { AdminPage } from "@/components/admin-pages";
import { GenreTiles } from "@/components/catalog-ui";
import { currentUser } from "@/lib/supabase/server";
import { categories } from "@/lib/domain";
import { animeCatalog, movieCatalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
const privatePages = new Set([
  "settings",
  "avatar-editor",
  "watchlist",
  "history",
  "following",
  "notifications",
  "my-level",
  "my-titles",
  "subscription",
  "payment-history",
  "admin",
  "staff",
  "reset-password",
]);
const authPages = new Set([
  "login",
  "register",
  "verify-email",
  "forgot-password",
  "reset-password",
]);
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { path = [] } = await params;
  const search = await searchParams;
  const root = path[0];
  if (!root) return <Home />;
  if (privatePages.has(root) && !(await currentUser())) redirect("/login");
  let content;
  if (authPages.has(root) && path.length === 1)
    content = <AuthPage mode={root} />;
  else if (root === "premium" && path.length === 1) content = <PremiumPage />;
  else if (["admin", "staff"].includes(root))
    content = (
      <AdminPage
        path={path}
        page={Math.min(100, Math.max(1, Number(search.page) || 1))}
        q={search.q?.slice(0, 50)}
      />
    );
  else if (privatePages.has(root)) content = <AccountPage path={path} />;
  else if (root === "search") content = <ProviderSearch initialQuery={search.q?.slice(0,100)} />;
  else if (root === "title" && path[1]?.startsWith("rp_")) content = <ProviderTitlePage id={path[1]} />;
  else if (root === "watch" && path[1]?.startsWith("rp_")) content = <ProviderWatchPage id={path[1]} />;
  else if (root === "title" && path[1])
    content = (
      <TitlePage
        slug={path[1]}
        season={path[2] === "season" ? path[3] : undefined}
      />
    );
  else if (root === "watch-now" && path.length === 1)
    content = (
      <WatchablePage
        page={Math.min(100, Math.max(1, Math.floor(Number(search.page) || 1)))}
      />
    );
  else if (root === "streaming" && path.length === 2)
    content = <OfficialStreamPage id={path[1]} video={search.video} />;
  else if (root === "open-cinema" && path.length === 1)
    content = <OpenCinemaPage />;
  else if (root === "watch" && path[1]) content = <WatchPage id={path[1]} />;
  else if (root === "community")
    content = (
      <CommunityPage
        target={path[1] ? `comment:${path[1]}` : search.target || "community"}
      />
    );
  else if (root === "leaderboard")
    content = <Leaderboard period={search.period} />;
  else if (root === "profile" && path[1])
    content = <PublicProfile username={path[1]} />;
  else if (
    [
      "about",
      "contact",
      "help",
      "privacy",
      "terms",
      "copyright",
      "content-report",
    ].includes(root)
  )
    content = <InfoPage id={root} target={search.target} />;
  else if (root === "genres")
    content = (
      <>
        <PageHeading
          title="Pilih Duniamu"
          subtitle="Dari petualangan epik hingga cerita yang terasa dekat."
        />
        <GenreTiles />
      </>
    );
  else if (
    ["explore", "search", ...categories.map((c) => c[0])].includes(root)
  ) {
    const category = categories.find((c) => c[0] === root);
    const categoryId = category?.[0] || "anime";
    const q = search.q?.slice(0, 100) || "";
    const genre = search.genre?.slice(0, 40) || "";
    let initialResult;
    try {
      initialResult = ["anime", "donghua"].includes(categoryId)
        ? await animeCatalog({
            q,
            genre,
            country: categoryId === "donghua" ? "CN" : undefined,
          })
        : await movieCatalog({ q, category: categoryId });
    } catch {
      /* Client retry and provider error state remain available. */
    }
    content = (
      <>
        <PageHeading
          title={
            root === "search"
              ? "Temukan Ceritamu"
              : category?.[1] || "Semesta Tanpa Batas"
          }
          subtitle="Anime, donghua, drama, dan film. Petualangan berikutnya ada di sini."
        />
        {root !== "search" && (
          <OfficialStreamCards
            category={root === "explore" ? undefined : categoryId}
          />
        )}
        <SearchCatalog
          key={`${categoryId}:${q}:${genre}`}
          initialQuery={q}
          initialGenre={genre}
          initialCategory={categoryId}
          initialResult={initialResult}
        />
      </>
    );
  } else notFound();
  return (
    <div className="page">
      {search.error && (
        <div className="notice error" role="alert">
          {search.error.slice(0, 350)}
        </div>
      )}
      {search.success && (
        <div className="notice success" role="status">
          Permintaan berhasil diproses.
        </div>
      )}
      {content}
    </div>
  );
}
