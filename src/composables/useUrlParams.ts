import { reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  defaults,
  parseParams,
  serializeParams,
  type ParamSpecs,
  type ParamValues,
} from '@/lib/params'

/**
 * Reactive simulation parameters backed by the query string. Editing a value
 * updates the URL (router.replace, debounced) so the address bar is always a
 * shareable link to the current configuration.
 */
export function useUrlParams<S extends ParamSpecs>(specs: S) {
  const route = useRoute()
  const router = useRouter()
  const values = reactive(parseParams(specs, route.query)) as ParamValues<S>
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(
    () => ({ ...values }),
    () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        router.replace({ query: serializeParams(specs, values) }).catch(() => undefined)
      }, 150)
    },
  )

  function resetParams() {
    Object.assign(values, defaults(specs))
  }

  return { values, resetParams }
}
