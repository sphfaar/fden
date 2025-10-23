// import axios from 'axios';
//
// export async function getProductThumbnails(urls: string[]) {
// 	try {
// 		const res = await Promise.all(
// 			urls.map(async (url) => {
// 				const res = await axios.request({
// 					method: 'GET',
// 					url: url,
// 					responseType: 'arraybuffer'
// 				});
// 				const unit8Array = new Uint8Array(res.data);
// 				return Array.from(unit8Array);
// 			})
// 		);
// 		return res;
// 	} catch {
// 		console.warn(
// 			'thumbnails not fetched even though URLs are present, could be 404 response or other error',
// 			urls
// 		);
// 		return Promise.resolve(null);
// 	}
// }

export function getProductThumbnails(urls: string[]): string[] | undefined {
	return urls.map((url) => `/proxy?url=${encodeURIComponent(url)}`);
}
