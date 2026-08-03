export default function StarRating({
  rating,
  reviewCount,
}: {
  rating: number;
  reviewCount?: number;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1 text-gold">
      {stars.map((star) => (
        <span key={star} aria-hidden="true">
          {star <= Math.round(rating) ? "★" : "☆"}
        </span>
      ))}
      {reviewCount !== undefined && (
        <span className="ml-1 text-xs text-foreground/60">({reviewCount})</span>
      )}
    </div>
  );
}
