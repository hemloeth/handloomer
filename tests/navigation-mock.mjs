let currentPathname = "/";
let currentSearch = "";

export function __setPathname(p) {
  currentPathname = p;
}
export function __setSearch(s) {
  currentSearch = s;
}
export function usePathname() {
  return currentPathname;
}
export function useSearchParams() {
  return new URLSearchParams(currentSearch);
}
export function useRouter() {
  return { push() {}, replace() {}, back() {}, forward() {}, prefetch() {}, refresh() {} };
}
export function useParams() {
  return {};
}
export function redirect() {}
export function notFound() {}
export function permanentRedirect() {}
