export function choiceAccessibility(type: 'single' | 'multiple', selected: boolean, disabled: boolean) {
  return { role: type === 'single' ? 'radio' as const : 'checkbox' as const,
    state: { checked: selected, disabled } };
}
