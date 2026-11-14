'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Globe, Linkedin } from 'lucide-react'

export type ContributorItem = {
    id: string
    name: string
    role?: string
    company?: string
    description?: string
    image: string
    imageFit?: 'contain' | 'cover'
    linkedin?: string
    website?: string
}

export function ContributorGrid({ items }: { items: ContributorItem[] }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((item, index) => (
                <motion.div
                    key={item.id}
                    className="group relative bg-neutral-900/40 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-500 hover:shadow-[0_0_40px_rgba(var(--primary-rgb),0.15)] hover:-translate-y-2"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                    {/* Image Aspect Ratio Container */}
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-800/50">
                        {item.image ? (
                            <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                className={`transition-transform duration-700 group-hover:scale-105 ${item.imageFit === 'contain' ? 'object-contain object-[center_35%] p-3' : 'object-cover'}`}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-600">
                                No Image
                            </div>
                        )}

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />

                        {/* Content */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 transform transition-transform duration-500">
                            <h3 className="break-words text-xl font-bold text-white mb-1 leading-tight drop-shadow-md">{item.name}</h3>
                            {/* Company */}
                            {item.company && (
                                <p className="text-white/80 text-xs font-medium drop-shadow-sm mb-2">
                                    {item.company}
                                </p>
                            )}
                            {/* Description */}
                            {item.description && (
                                <p className="text-white/80 text-sm mb-3 line-clamp-3 drop-shadow-sm">
                                    {item.description}
                                </p>
                            )}
                            {/* LinkedIn Icon and Role */}
                            {(item.linkedin || item.website || item.role) && (
                                <div className={`flex items-center gap-2 ${item.website ? '' : 'justify-between'}`}>
                                    {item.linkedin && (
                                        <a
                                            href={item.linkedin}
                                            aria-label={`Visit ${item.name} on LinkedIn`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-[#0A66C2] hover:text-white text-white transition-all duration-300 backdrop-blur-md border border-white/20 hover:border-transparent hover:scale-110 shadow-lg flex-shrink-0"
                                        >
                                            <Linkedin size={16} />
                                        </a>
                                    )}
                                    {item.website && (
                                        <a
                                            href={item.website}
                                            aria-label={`Visit ${item.name} website`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-300 backdrop-blur-md border border-white/20 hover:border-transparent hover:scale-105 shadow-lg flex-shrink-0"
                                        >
                                            <Globe size={16} />
                                        </a>
                                    )}
                                    {item.role && (
                                        <span className="px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-md border border-white/10 text-xs font-medium text-white shadow-sm">
                                            {item.role}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}
