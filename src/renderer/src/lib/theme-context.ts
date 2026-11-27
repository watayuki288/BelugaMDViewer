import React, { useContext } from 'react'

export const ThemeDarkContext = React.createContext<boolean>(true)

export function useThemeDark(): boolean {
  return useContext(ThemeDarkContext)
}
