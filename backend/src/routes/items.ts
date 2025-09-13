type Item = {
  examine: string;
  id: number;
  members: boolean;
  lowalch: number;
  limit: number;
  value: number;
  highalch: number;
  icon: string;
  name: string;
};

/**
 * @see https://prices.runescape.wiki/api/v1/osrs/mapping
 */
export const items = async () => {
  const getItems = async () => {
    try {
      const response = await fetch(
        "https://prices.runescape.wiki/api/v1/osrs/mapping"
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(error);
    }
  };

  const filterItems = (items: Item[]) => {
    return items.filter((item) => {
      return {
        name: item.name,
        id: item.id,
        icon: item.icon,
        examine: item.examine,
      };
    });
  };

  const allItems = await getItems();
  const filteredItems = filterItems(allItems);
  console.log(filteredItems);
  return filteredItems;
};
