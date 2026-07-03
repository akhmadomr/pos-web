export const TAX_RATE = Number(import.meta.env.VITE_TAX_RATE ?? 0)
export const SERVICE_CHARGE_RATE = Number(import.meta.env.VITE_SERVICE_CHARGE ?? 0)

export function groupVariantsByType(variants = []) {
  return variants.reduce((groups, variant) => {
    const type = variant.type || 'option'
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(variant)
    return groups
  }, {})
}

export function buildDefaultVariantSelections(variants = []) {
  const groups = groupVariantsByType(variants)
  const selections = {}

  Object.entries(groups).forEach(([type, options]) => {
    const defaultOption = options.find((v) => v.is_default) ?? options[0]
    if (defaultOption) {
      selections[type] = defaultOption.name
    }
  })

  return selections
}

export function calculateItemUnitPrice(product, variantSelections = {}) {
  let price = Number(product.selling_price ?? 0)

  Object.entries(variantSelections).forEach(([type, name]) => {
    const variant = product.variants?.find((v) => v.type === type && v.name === name)
    if (variant) {
      price += Number(variant.price_adjustment ?? 0)
    }
  })

  return price
}

export function calculateAddonsPrice(product, addonIds = []) {
  if (!addonIds.length) return 0

  return addonIds.reduce((sum, id) => {
    const addon = product.addons?.find((a) => a.id === id)
    return sum + Number(addon?.price ?? 0)
  }, 0)
}

export function buildVariantLabel(product, variantSelections = {}) {
  return Object.values(variantSelections).filter(Boolean).join(', ')
}

export function buildAddonsLabel(product, addonIds = []) {
  return addonIds
    .map((id) => product.addons?.find((a) => a.id === id)?.name)
    .filter(Boolean)
    .join(', ')
}

export function itemFingerprint(item) {
  return [
    item.product_id,
    JSON.stringify(item.variant_selections ?? {}),
    [...(item.addon_ids ?? [])].sort().join(','),
    item.notes ?? '',
  ].join('|')
}
