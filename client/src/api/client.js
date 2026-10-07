import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});
api.interceptors.request.use((c) => {
  const token = sessionStorage.getItem("token");
  if (token) c.headers.Authorization = "Bearer " + token;
  return c;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401 && !e.config.url.includes("/auth/login")) {
      sessionStorage.removeItem("token");
      window.dispatchEvent(new Event("session-expired"));
    }
    return Promise.reject(e);
  },
);
export const message = (e) =>
  (e.response?.data?.message || e.message || "Request failed") +
  (e.response?.data?.errors?.length
    ? " — " +
      e.response.data.errors.map((x) => x.field + ": " + x.message).join("; ")
    : "");
export async function download(url, name) {
  let data;
  try {
    ({ data } = await api.get(url, { responseType: "blob" }));
  } catch (e) {
    if (e.response?.data instanceof Blob) {
      try {
        e.response.data = JSON.parse(await e.response.data.text());
      } catch {
        /* Keep the original error for non-JSON responses. */
      }
    }
    throw e;
  }
  const objectUrl = URL.createObjectURL(new Blob([data]));
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
