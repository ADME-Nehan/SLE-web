const DEFAULT_CATEGORIES = [
  "All",
  "Business",
  "Startups",
  "SME",
  "Finance",
  "Economy",
  "Investment",
  "Technology",
  "Tourism",
  "Exports",
  "Agriculture",
  "Policy",
  "Local News"
];

export default function CategoryBar({ active, categories, onChange }) {
  const list = categories?.length ? categories : DEFAULT_CATEGORIES;

  return (
    <div className="category-wrap">
      <div className="category-scroll">
        {list.map((category) => {
          const isActive = active === category;

          return (
            <button
              key={category}
              type="button"
              className={`category-pill ${isActive ? "active" : ""}`}
              onClick={() => onChange(category)}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}