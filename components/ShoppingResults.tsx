'use client';

interface ShoppingProduct {
  title: string;
  price: number;
  formatted_price: string;
  brand: string;
  mall: string;
  image_url: string;
  product_url: string;
  comment: string;
}

interface ShoppingData {
  type: 'shopping_results';
  summary: {
    query: string;
    count: number;
    min_price: number;
    max_price: number;
    avg_price: number;
  };
  products: ShoppingProduct[];
}

/**
 * Parse shopping data from content string.
 * Returns null if content is not a shopping result.
 */
export function parseShoppingData(content: string): ShoppingData | null {
  const marker = '<!--SHOP_DATA:';
  if (!content.includes(marker)) return null;

  try {
    const start = content.indexOf(marker) + marker.length;
    const end = content.indexOf('-->', start);
    if (end === -1) return null;
    const json = content.substring(start, end);
    const data = JSON.parse(json);
    if (data?.type === 'shopping_results' && Array.isArray(data.products)) {
      return data as ShoppingData;
    }
  } catch {
    // not valid shopping data
  }
  return null;
}

function formatPrice(price: number): string {
  return price.toLocaleString('ko-KR') + '원';
}

export function ShoppingResults({ data }: { data: ShoppingData }) {
  const { summary, products } = data;

  return (
    <div className="space-y-3">
      {/* Summary Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
        <span className="text-lg">🛍️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">
            &ldquo;{summary.query}&rdquo;
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.count}개 상품 · {formatPrice(summary.min_price)} ~ {formatPrice(summary.max_price)}
            <span className="text-slate-500"> · 평균 {formatPrice(summary.avg_price)}</span>
          </p>
        </div>
      </div>

      {/* Product Cards */}
      <div className="space-y-2">
        {products.map((product, i) => (
          <ProductCard key={i} product={product} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product, rank }: { product: ShoppingProduct; rank: number }) {
  return (
    <a
      href={product.product_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 p-2.5 rounded-lg border border-slate-700/20 bg-slate-800/20 hover:bg-slate-800/50 hover:border-slate-600/40 transition-all duration-200 no-underline"
    >
      {/* Image */}
      <div className="flex-shrink-0 relative">
        <span className="absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full bg-slate-700/90 text-[10px] font-bold text-slate-300 flex items-center justify-center">
          {rank}
        </span>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.title}
            loading="lazy"
            className="w-20 h-20 rounded-md object-cover bg-slate-800/50 border border-slate-700/20 group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-20 h-20 rounded-md bg-slate-800/50 border border-slate-700/20 flex items-center justify-center text-slate-600 text-xl">
            📦
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <p className="text-[13px] font-medium text-slate-200 leading-snug line-clamp-2 group-hover:text-purple-300 transition-colors">
          {product.title}
        </p>
        <p className="text-[15px] font-semibold text-purple-400">
          {product.formatted_price}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {product.brand && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">
              {product.brand}
            </span>
          )}
          {product.mall && (
            <span className="text-[11px] text-slate-500">
              {product.mall}
            </span>
          )}
        </div>
        {product.comment && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {product.comment}
          </p>
        )}
      </div>

      {/* Arrow */}
      <div className="flex-shrink-0 self-center text-slate-600 group-hover:text-slate-400 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-0 group-hover:opacity-100 transition-opacity">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </a>
  );
}
