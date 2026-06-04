"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";

const Map = dynamic(() => import("@/components/ToiletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-red-50">
      <p className="text-red-800">🚻 地図を読み込み中...</p>
    </div>
  ),
});

interface Toilet {
  id: number;
  name: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  accessible: string | null;
  opening_hours: string | null;
  fee: string | null;
  region: string | null;
  distance?: number;
}

const ALL_REGIONS = [
  { name: '関東',     emoji: '🗼', desc: '東京・神奈川・埼玉・千葉など' },
  { name: '関西',     emoji: '🏯', desc: '大阪・京都・兵庫・奈良など' },
  { name: '中京',     emoji: '🏙️', desc: '愛知・岐阜・三重・静岡' },
  { name: '北海道',   emoji: '🐻', desc: '北海道全域' },
  { name: '東北',     emoji: '⛄', desc: '宮城・福島・青森・岩手など' },
  { name: '北陸・信越', emoji: '🦀', desc: '新潟・長野・富山・石川・福井' },
  { name: '中国・四国', emoji: '🍋', desc: '広島・岡山・香川・愛媛など' },
  { name: '九州',     emoji: '🌋', desc: '福岡・熊本・鹿児島・長崎など' },
  { name: '沖縄',     emoji: '🌺', desc: '沖縄全島' },
];

const REGION_CENTERS: Record<string, [number, number]> = {
  '関東':       [35.68, 139.69],
  '関西':       [34.69, 135.50],
  '中京':       [35.18, 136.91],
  '北海道':     [43.06, 141.35],
  '東北':       [38.27, 140.87],
  '北陸・信越': [36.69, 137.21],
  '中国・四国': [34.40, 132.46],
  '九州':       [33.59, 130.42],
  '沖縄':       [26.21, 127.68],
};

function sortRegionsByLocation(lat: number, lng: number) {
  return [...ALL_REGIONS].sort((a, b) => {
    const [aLat, aLng] = REGION_CENTERS[a.name] || [35, 135];
    const [bLat, bLng] = REGION_CENTERS[b.name] || [35, 135];
    const distA = Math.sqrt((lat - aLat) ** 2 + (lng - aLng) ** 2);
    const distB = Math.sqrt((lat - bLat) ** 2 + (lng - bLng) ** 2);
    return distA - distB;
  });
}

const STORAGE_KEY = 'toilet_selected_regions';
const BOOKMARK_KEY = 'toilet_bookmarks';
const DEFAULT_CENTER: [number, number] = [34.7, 135.5];

type ViewType = "map" | "list" | "bookmarks";

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function InstallBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
    if (!isMobile) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShow(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setShow(false));
    if (ios) setTimeout(() => setShow(true), 2000);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => { setDeferredPrompt(null); setShow(false); });
    } else if (isIOS) {
      alert('① SafariでこのページのURLを開く\n② 下部の共有ボタン（四角に矢印）をタップ\n③「ホーム画面に追加」を選ぶ\n\n※ Chrome・Firefoxでは追加できません');
    } else {
      alert('Chromeのメニュー（右上の ⋮）をタップして\n「アプリをインストール」または\n「ホーム画面に追加」を選んでください');
    }
  }

  if (!show) return null;
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'2px solid #dc2626', padding:'12px 16px 28px', display:'flex', alignItems:'center', gap:12, zIndex:9999, boxShadow:'0 -4px 20px rgba(220,38,38,0.15)' }}>
      <span style={{ fontSize:'1.8rem', flexShrink:0 }}>📲</span>
      <div style={{ flex:1 }}>
        <p style={{ margin:'0 0 2px', fontWeight:800, fontSize:14, color:'#991b1b' }}>ホーム画面に追加する</p>
        <p style={{ margin:0, fontSize:11, color:'#dc2626' }}>
          {isIOS ? 'Safariで開く → 共有 → ホーム画面に追加' : 'アプリとしてインストール'}
        </p>
      </div>
      <button onClick={handleInstall} style={{ background:'linear-gradient(90deg,#dc2626,#991b1b)', color:'#fff', border:'none', borderRadius:10, padding:'8px 14px', fontWeight:800, fontSize:13, cursor:'pointer', flexShrink:0 }}>
        {isIOS ? '方法を見る' : '追加'}
      </button>
      <button onClick={() => setShow(false)} style={{ background:'none', border:'none', color:'#bbb', fontSize:'1rem', cursor:'pointer', padding:4, flexShrink:0 }}>✕</button>
    </div>
  );
}

export default function Home() {
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [sortedRegions, setSortedRegions] = useState(ALL_REGIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [showRegionSelect, setShowRegionSelect] = useState(false);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [hasLocation, setHasLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(true);
  const [view, setView] = useState<ViewType>("map");
  const [initialized, setInitialized] = useState(false);
  const currentPosRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(coords);
        setHasLocation(true);
        currentPosRef.current = coords;
        setSortedRegions(sortRegionsByLocation(coords[0], coords[1]));
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // locatingが完了してからlocalStorage確認・エリア選択判定
  useEffect(() => {
    if (locating) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSelectedRegions(JSON.parse(saved));
    } else {
      setShowRegionSelect(true);
    }
    const savedBookmarks = localStorage.getItem(BOOKMARK_KEY);
    if (savedBookmarks) { setBookmarks(new Set(JSON.parse(savedBookmarks))); }
    setInitialized(true);
  }, [locating]);

  useEffect(() => {
    if (!initialized || selectedRegions.length === 0) return;
    fetchToilets(selectedRegions);
  }, [selectedRegions, initialized]);

  async function fetchToilets(regions: string[]) {
    setLoading(true);
    const { data, error } = await supabase
      .from("toilets")
      .select("id, name, latitude, longitude, address, accessible, opening_hours, fee, region")
      .in("region", regions);
    if (error) console.error("Supabase error:", error);
    const raw = data || [];
    const pos = currentPosRef.current;
    if (pos) {
      const [lat, lng] = pos;
      setToilets(raw.map(r => ({ ...r, distance: calcDistance(lat, lng, r.latitude, r.longitude) })));
    } else {
      setToilets(raw);
    }
    setLoading(false);
  }

  const toggleBookmark = useCallback((id: number) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  function handleRegionToggle(region: string) {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  }

  function handleRegionConfirm() {
    if (selectedRegions.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedRegions));
    setShowRegionSelect(false);
  }

  const sortedToilets = [...toilets].sort((a, b) => {
    if (a.distance != null && b.distance != null) return a.distance - b.distance;
    if (a.distance != null) return -1;
    if (b.distance != null) return 1;
    return 0;
  });

  const searchedToilets = searchQuery.trim()
    ? sortedToilets.filter(r =>
        (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.address || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedToilets;

  const bookmarkedToilets = sortedToilets.filter(r => bookmarks.has(r.id));

  // ローディング中（位置情報取得中）
  if (locating) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50 gap-4">
        <p className="text-4xl">🚻</p>
        <p className="text-red-700 font-bold text-lg">位置情報を取得中...</p>
        <p className="text-red-400 text-sm">少々お待ちください</p>
      </div>
    );
  }

  if (showRegionSelect) {
    return (
      <div className="flex flex-col min-h-screen bg-red-50">
        <header className="bg-red-700 text-white px-4 py-4 text-center">
          <h1 className="text-2xl font-bold">🚻 トイレの駆け込み寺</h1>
          <p className="text-sm text-red-200 mt-1">使うエリアを選んでください</p>
        </header>
        <div className="flex-1 px-4 py-4">
          <p className="text-xs text-gray-500 mb-4 text-center">複数選択できます。後から変更も可能です。</p>
          <div className="bg-red-100 rounded-lg px-4 py-3 mb-4 text-center">
            <a href="/about" className="text-red-700 text-xs underline font-medium">
              📋 プライバシーポリシー・免責事項・ご注意
            </a>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {sortedRegions.map(region => {
              const isSelected = selectedRegions.includes(region.name);
              return (
                <button key={region.name} onClick={() => handleRegionToggle(region.name)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected ? "bg-red-600 border-red-600 text-white" : "bg-white border-red-200 text-red-900"
                  }`}
                >
                  <span className="text-2xl">{region.emoji}</span>
                  <div>
                    <p className="font-bold text-sm">{region.name}</p>
                    <p className={`text-xs mt-0.5 ${isSelected ? "text-red-200" : "text-gray-500"}`}>{region.desc}</p>
                  </div>
                  {isSelected && <span className="ml-auto text-white text-lg">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sticky bottom-0 p-4 bg-red-50 border-t border-red-200">
          <button onClick={handleRegionConfirm} disabled={selectedRegions.length === 0}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
              selectedRegions.length > 0 ? "bg-red-600 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {selectedRegions.length > 0 ? `${selectedRegions.join("・")}で始める 🚻` : "エリアを選んでください"}
          </button>
        </div>
      </div>
    );
  }

  const ToiletListItem = ({ toilet }: { toilet: Toilet }) => {
    const isBookmarked = bookmarks.has(toilet.id);
    return (
      <li className="px-4 py-3 bg-white hover:bg-red-50">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p
              className="font-medium text-red-900 text-sm truncate cursor-pointer underline decoration-red-300"
              onClick={() => {
                setView("map");
                setTimeout(() => {
                  const map = (window as any)._toiletMap;
                  if (map) map.setView([toilet.latitude, toilet.longitude], 17);
                }, 100);
              }}
            >
              🚻 {toilet.name || "公衆トイレ"}
            </p>
            {toilet.distance != null && (
              <p className="text-xs text-red-600 mt-0.5 font-bold">
                📍 {formatDistance(toilet.distance)}
              </p>
            )}
            <div className="flex gap-2 mt-1 flex-wrap">
              {toilet.accessible === 'yes' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">♿ 多目的</span>}
              {toilet.fee === 'no' || !toilet.fee ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">無料</span> : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">有料</span>}
              {toilet.opening_hours === '24/7' && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">24時間</span>}
            </div>
            {toilet.address && <p className="text-xs text-gray-500 mt-0.5 truncate">{toilet.address}</p>}
            {toilet.opening_hours && toilet.opening_hours !== '24/7' && <p className="text-xs text-gray-400 mt-0.5">🕐 {toilet.opening_hours}</p>}
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            <button onClick={() => toggleBookmark(toilet.id)}
              className={`text-xl ${isBookmarked ? "text-red-400" : "text-gray-300"}`}>
              {isBookmarked ? "⭐" : "☆"}
            </button>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${toilet.latitude},${toilet.longitude}`}
              target="_blank" rel="noopener noreferrer"
              style={{ width:"28px", height:"28px", borderRadius:"50%", border:"2px solid #dc2626", background:"white", color:"#dc2626", fontSize:"12px", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}
              title="ルート案内">🗺️</a>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-red-50">
      <header className="bg-red-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <button onClick={() => setShowRegionSelect(true)} className="text-left">
          <h1 className="text-xl font-bold">🚻 トイレの駆け込み寺</h1>
          <p className="text-xs text-red-300">タップでエリア変更</p>
        </button>
        <div className="flex items-center gap-2">
          <p className="text-xs text-red-200">
            {loading ? "読込中..." : `${toilets.length}件`}
          </p>
          <a href="/about" className="text-xs text-red-200 border border-red-300 rounded-full px-2 py-0.5 no-underline">ℹ️ about</a>
        </div>
      </header>

      <div className="flex bg-white border-b border-red-100">
        <button onClick={() => setView("map")}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${view === "map" ? "text-red-800 border-b-2 border-red-600" : "text-gray-400"}`}
        >🗺️ 地図</button>
        <button onClick={() => setView("list")}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${view === "list" ? "text-red-800 border-b-2 border-red-600" : "text-gray-400"}`}
        >📋 リスト</button>
        <button onClick={() => setView("bookmarks")}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${view === "bookmarks" ? "text-red-800 border-b-2 border-red-600" : "text-gray-400"}`}
        >⭐ {bookmarks.size > 0 ? bookmarks.size : ""}</button>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-800">🚻 読み込み中...</p>
          </div>
        ) : view === "map" ? (
          <div className="h-full relative">
            <Map toilets={toilets} center={center} bookmarks={bookmarks} onToggleBookmark={toggleBookmark} />
            {hasLocation && (
              <button
                onClick={() => {
                  const map = (window as any)._toiletMap;
                  if (map && currentPosRef.current) {
                    map.setView(currentPosRef.current, 16);
                  }
                }}
                style={{ position:'absolute', bottom:32, right:12, zIndex:1000, width:44, height:44, borderRadius:'50%', background:'#dc2626', border:'3px solid white', color:'white', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}
                title="現在地に戻る"
              >📍</button>
            )}
          </div>
        ) : view === "bookmarks" ? (
          <div className="h-full overflow-y-auto">
            {bookmarkedToilets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <p className="text-gray-500 text-sm">お気に入りはまだありません</p>
              </div>
            ) : (
              <ul className="divide-y divide-red-100">
                {bookmarkedToilets.map(r => <ToiletListItem key={r.id} toilet={r} />)}
              </ul>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-white border-b border-red-100">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="施設名・住所で検索..."
                  className="w-full pl-8 pr-8 py-2 text-sm border border-red-200 rounded-full bg-red-50 focus:outline-none focus:border-red-500 text-gray-800 placeholder-gray-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✕</button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {searchedToilets.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-gray-500 text-sm">トイレが見つかりません</p>
                </div>
              ) : (
                <ul className="divide-y divide-red-100">
                  {searchedToilets.map(r => <ToiletListItem key={r.id} toilet={r} />)}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
      <InstallBanner />
    </div>
  );
}
