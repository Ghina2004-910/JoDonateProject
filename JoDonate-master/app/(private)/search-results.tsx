import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";


export default function SearchResultsScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  return (
    <Redirect
      href={{
        pathname: "/(private)/donations",
        params: { q: typeof q === "string" ? q : "" },
      }}
    />
  );
}
