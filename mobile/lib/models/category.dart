class Category {
  final String id;
  final String slug;
  final String name;
  final String? description;
  final String? icon;
  final int sortOrder;

  const Category({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.icon,
    this.sortOrder = 0,
  });

  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: j['id'] as String,
        slug: j['slug'] as String,
        name: j['name'] as String,
        description: j['description'] as String?,
        icon: j['icon'] as String?,
        sortOrder: (j['sort_order'] as num?)?.toInt() ?? 0,
      );
}
