import React from 'react';

const Footer: React.FC = () => {
    const repoPath = "https://github.com/PriyanshuPz/tsbin";

    const docLinks = [
        { title: 'Contribute', href: `${repoPath}/blob/master/CONTRIBUTING.md` },
        { title: 'Code of Conduct', href: `${repoPath}/blob/master/CODE_OF_CONDUCT.md` },
        { title: 'Issues', href: `${repoPath}/issues` },
        { title: 'License', href: `${repoPath}/blob/master/LICENSE` },
    ];

    return (
        <footer className="text-center py-4 border-t border-gray-100 bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Documentation and Community Links */}
                <div className="flex flex-wrap justify-center space-x-4 mb-2 text-xs">
                    {docLinks.map((link, index) => (
                        <React.Fragment key={link.title}>
                            <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-500 hover:text-blue-600 transition-colors duration-200"
                            >
                                {link.title}
                            </a>
                            {index < docLinks.length - 1 && (
                                <span className="text-gray-300">|</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <p className="text-xs text-gray-400 mt-1">
                    &copy; {new Date().getFullYear()} tsbin | <a href={repoPath} target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">View Source</a>
                </p>
            </div>
        </footer>
    );
};

export default Footer;