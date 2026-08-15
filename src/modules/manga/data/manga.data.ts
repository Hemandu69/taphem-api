import type { Manga } from "../manga.types.js";

/**
 * Seed data representing the initial in-memory Manga Catalog.
 * Contains 8 realistic fictional manga records across diverse genres.
 */
export const SEED_MANGA: Manga[] = [
  {
    id: "manga_01j7x0a1b2c3d4e5f6g7h8j9k0",
    slug: "echoes-of-the-abyss",
    title: "Echoes of the Abyss",
    alternativeTitles: ["Shinsou no Zankyou", "심연의 메아리", "深渊的回响"],
    author: "Renjiro Kuroki",
    artist: "Aoi Tachibana",
    description:
      "In a world where deep-sea chasms open portals to forgotten dimensions, a young diver named Kael discovers an ancient relic that anchors the souls of those lost to the dark waters. To unravel his sister's disappearance, he must descend into the uncharted depths of the Seventh Trench.",
    coverImage: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
    genres: ["Dark Fantasy", "Supernatural", "Mystery", "Adventure"],
    status: "ongoing",
    rating: 8.9,
    releaseYear: 2024,
    chapterCount: 48
  },
  {
    id: "manga_02k8y1b2c3d4e5f6g7h8j9k0l1",
    slug: "neon-valkyrie",
    title: "Neon Valkyrie",
    alternativeTitles: ["Shin Neon Senki", "네온 발키리", "霓虹女武神"],
    author: "Elena Rostova",
    artist: "Hironori Sato",
    description:
      "Set in the vertical mega-city of Neo-Kyoto in the year 2142, cybernetically augmented operative Maya operates beyond corporate law. When an AI consciousness breaks its containment protocols, Maya is thrust into a conspiracy that threatens to shut down the city's power grid and plunge millions into darkness.",
    coverImage: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80",
    genres: ["Cyberpunk", "Sci-Fi", "Action", "Psychological"],
    status: "ongoing",
    rating: 9.1,
    releaseYear: 2023,
    chapterCount: 76
  },
  {
    id: "manga_03l9z2c3d4e5f6g7h8j9k0l1m2",
    slug: "chronicles-of-the-celestial-blade",
    title: "Chronicles of the Celestial Blade",
    alternativeTitles: ["Tenken Senki", "천검전기", "天剑异闻录"],
    author: "Shinichi Hayashi",
    artist: "Shinichi Hayashi",
    description:
      "Forged from the fragments of a fallen constellation, the Celestial Blade chooses its wielder once every millennium. When modest swordsmith apprentice Jin accidentally awakens the blade's dormant spirit, rival martial clans and mythical beasts converge to claim the power of the heavens.",
    coverImage: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80",
    genres: ["Fantasy", "Martial Arts", "Adventure", "Action"],
    status: "ongoing",
    rating: 8.6,
    releaseYear: 2022,
    chapterCount: 114
  },
  {
    id: "manga_04m0a3d4e5f6g7h8j9k0l1m2n3",
    slug: "whispers-in-the-starlight",
    title: "Whispers in the Starlight",
    alternativeTitles: ["Hoshizora no Sasayaki", "별빛 속의 속삭임", "星光下的私语"],
    author: "Yuki Minami",
    artist: "Haruka Mori",
    description:
      "Hana transferred to an isolated mountain observatory school to escape her past in Tokyo. There, she meets Sora, an enigmatic astronomy prodigy who can only remember people by their emotional resonance. Together, they map the nocturnal sky while navigating adolescent vulnerability and dreams.",
    coverImage: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=800&q=80",
    genres: ["Romance", "Drama", "Slice of Life", "School"],
    status: "completed",
    rating: 8.8,
    releaseYear: 2021,
    chapterCount: 52
  },
  {
    id: "manga_05n1b4e5f6g7h8j9k0l1m2n3o4",
    slug: "soul-weavers-requiem",
    title: "Soul Weaver's Requiem",
    alternativeTitles: ["Tamashii no Koukyoukyoku", "영혼술사의 진혼곡", "织魂者的安魂曲"],
    author: "Daisuke Endo",
    artist: "Kana Shimizu",
    description:
      "Soul Weavers are tasked with guiding lingering regrets into musical threads before they turn into malevolent specters. As the youngest maestro in the Imperial Requiem Guild, Lyra faces an unprecedented dissonance spreading across the capital that consumes human memories.",
    coverImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
    genres: ["Supernatural", "Psychological", "Mystery", "Drama"],
    status: "ongoing",
    rating: 8.5,
    releaseYear: 2024,
    chapterCount: 32
  },
  {
    id: "manga_06o2c5f6g7h8j9k0l1m2n3o4p5",
    slug: "apex-vanguard",
    title: "Apex Vanguard",
    alternativeTitles: ["Kyokugen Kouki", "에이펙스 뱅가드", "绝峰先锋"],
    author: "Marcus Vance",
    artist: "Kenjiro Takahashi",
    description:
      "Humanity's last frontier is guarded by biomechanical combat suits known as Vanguards. When an extraterrestrial breach collapses Sector 4's outer defensive perimeter, pilot cadet Ray must pilot an experimental prototype to protect the underground sanctuary of Haven.",
    coverImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    genres: ["Sci-Fi", "Mecha", "Action", "Military"],
    status: "ongoing",
    rating: 8.4,
    releaseYear: 2023,
    chapterCount: 65
  },
  {
    id: "manga_07p3d6g7h8j9k0l1m2n3o4p5q6",
    slug: "the-alchemist-of-solitude",
    title: "The Alchemist of Solitude",
    alternativeTitles: ["Kodoku no Renkinjutsushi", "고독의 연금술사", "孤独的炼金术师"],
    author: "Cedric Laurent",
    artist: "Mira Han",
    description:
      "Exiled to the mist-shrouded borderlands for pursuing forbidden transmutation research, Master Alchemist Vane lives a peaceful life in isolation. But when a cursed young runaway collapses on his doorstep, Vane is drawn into an international struggle over the elixir of immortality.",
    coverImage: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
    genres: ["Fantasy", "Adventure", "Mystery", "Drama"],
    status: "hiatus",
    rating: 8.7,
    releaseYear: 2020,
    chapterCount: 88
  },
  {
    id: "manga_08q4e7h8j9k0l1m2n3o4p5q6r7",
    slug: "midnight-clockwork",
    title: "Midnight Clockwork",
    alternativeTitles: ["Shin'ya no Karakuri", "자정의 태엽시계", "午夜齿轮"],
    author: "Arthur Pendelton",
    artist: "Tetsuya Ogata",
    description:
      "In the steam-powered metropolis of Oakhaven, crime lord assassinations are being carried out by mechanical automatons operating with supernatural precision. Consulting detective Vincent and clockwork engineer Clara must uncover the puppet master before the midnight bells strike.",
    coverImage: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80",
    genres: ["Steampunk", "Mystery", "Detective", "Historical"],
    status: "completed",
    rating: 8.9,
    releaseYear: 2019,
    chapterCount: 94
  }
];
