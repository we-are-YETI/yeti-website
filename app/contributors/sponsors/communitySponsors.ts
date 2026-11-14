export interface SponsorItem {
    id: string
    name: string
    role?: string
    description?: string
    image: string
    imageFit?: 'contain' | 'cover'
    linkedin?: string
    website?: string
}

export const communitySponsors: SponsorItem[] = [
    {
        id: 'sponsor-skinnovation',
        name: 'SKInnovation',
        image: '/sponsors/skinnovation.png',
        imageFit: 'contain',
        website: 'https://skinnovation.at/',
    },
]
