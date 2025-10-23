export const scrapingTypeColors = new Map<
	SourceDescriptors['scrapingType'],
	{
		descriptors: {
			consensus: 'JSON' | 'HTML' /* | 'noncompliant'*/;
			description: string;
			shortDescription: string;
			longDescription: string;
		};
		style: {
			bg: string;
			stroke: string;
			border: string;
			textColor: string;
			shadow: {
				top: string;
				bottom: string;
			};
		};
	}
>([
	[
		'JSON API',
		{
			descriptors: {
				consensus: 'JSON',
				description: 'REST JSON API',
				shortDescription: 'FAST',
				longDescription: 'sources with fast machine-readable protocols'
			},
			style: {
				bg: 'bg-cyan-300/5',
				stroke: 'stroke-cyan-300',
				border: 'border-cyan-300',
				textColor: 'text-cyan-300',
				shadow: {
					top: 'shadow-[0_-5px_6px_-1px] shadow-cyan-300',
					bottom: 'shadow-md shadow-cyan-300'
				}
			}
		}
	],
	[
		'HTML parser',
		{
			descriptors: {
				consensus: 'HTML',
				shortDescription: 'SLOW',
				description: 'HTML (no JS) parsed',
				longDescription:
					'sources without machine-readable protocols due to abstention or negligence'
			},
			style: {
				bg: 'bg-yellow-500/5',
				stroke: 'stroke-yellow-500',
				border: 'border-yellow-500',
				textColor: 'text-yellow-500',
				shadow: {
					top: 'shadow-[0_-5px_6px_-1px] shadow-yellow-500',
					bottom: 'shadow-md shadow-yellow-500'
				}
			}
		}
	]
	// [
	// 	'Automated browser',
	// 	{
	// 		descriptors: {
	// 			consensus: 'noncompliant',
	// 			description: 'Remote automated browser',
	// 			shortDescription: 'very slow',
	// 			longDescription:
	// 				'sources with anti-scraping countermeasures, automated headless browser needed'
	// 		},
	// 		style: {
	// 			bg: 'bg-rose-600/5',
	// 			stroke: 'stroke-rose-600',
	// 			border: 'border-rose-600',
	// 			textColor: 'text-rose-600',
	// 			shadow: {
	// 				top: 'shadow-[0_-5px_6px_-1px] shadow-rose-600',
	// 				bottom: 'shadow-md shadow-rose-600'
	// 			}
	// 		}
	// 	}
	// ]
]);
