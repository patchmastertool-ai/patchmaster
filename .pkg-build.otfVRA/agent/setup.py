import setuptools

with open("requirements.txt") as f:
    requirements = f.read().splitlines()

setuptools.setup(
    name="patchmaster-agent",
    version="2.0.0",
    author="VYGROUP",
    author_email="support@VYGROUP.com",
    description="PatchMaster Enterprise Agent",
    packages=setuptools.find_packages(),
    py_modules=["agent"],
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "patchmaster-agent=agent:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.8',
)
