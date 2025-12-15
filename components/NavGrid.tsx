// NavGrid.tsx
import React, { ReactElement, ReactNode } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import type { NavButtonProps } from "@/components/NavButton";

const { width } = Dimensions.get("window");

type NavGridProps = {
  children: ReactElement<NavButtonProps> | ReactElement<NavButtonProps>[];
};

export function NavGrid({ children }: NavGridProps) {
  const columns = width > 900 ? 4 : width > 600 ? 3 : 2;
  const itemWidth = `${100 / columns - 3}%`;

  return (
    <View style={styles.grid}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, {
          // もともとの containerStyle があればそれも残す
          containerStyle: [{ width: itemWidth }, child.props.containerStyle],
        } as Partial<NavButtonProps>)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    columnGap: 12,
    justifyContent: "space-between",
  },
});
