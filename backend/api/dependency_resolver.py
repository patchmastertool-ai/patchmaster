"""Dependency resolver for patch packages.

Resolves dependencies between patches using topological sort.
Handles requires, conflicts, and replaces relationships.
"""

import logging
from typing import Dict, List, Set, Optional, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class DependencyError(Exception):
    """Raised when dependency resolution fails."""

    pass


class CircularDependencyError(DependencyError):
    """Raised when circular dependencies are detected."""

    pass


class MissingDependencyError(DependencyError):
    """Raised when a required dependency cannot be found."""

    pass


class ConflictError(DependencyError):
    """Raised when conflicting packages are detected."""

    pass


class DependencyType(str, Enum):
    """Types of package dependencies."""

    REQUIRES = "requires"  # Hard dependency - must be installed
    RECOMMENDS = "recommends"  # Soft dependency - recommended
    CONFLICTS = "conflicts"  # Cannot be installed together
    REPLACES = "replaces"  # This package replaces another
    PROVIDES = "provides"  # This package provides a virtual package


@dataclass
class PackageMetadata:
    """Metadata for a patch/package."""

    package_id: str
    name: str
    version: str
    requires: List[str] = field(default_factory=list)
    conflicts: List[str] = field(default_factory=list)
    replaces: List[str] = field(default_factory=list)
    provides: List[str] = field(default_factory=list)
    dependencies: Dict[str, List[str]] = field(default_factory=dict)


class DependencyResolver:
    """Resolves dependencies between patches."""

    def __init__(self, packages: Dict[str, PackageMetadata]):
        """
        Initialize resolver with available packages.

        Args:
            packages: Dictionary mapping package IDs to their metadata
        """
        self.packages = packages
        self._dep_graph: Dict[str, Set[str]] = {}
        self._reverse_graph: Dict[str, Set[str]] = {}
        self._build_graph()

    def _build_graph(self):
        """Build the dependency graph and reverse graph."""
        for pkg_id, pkg in self.packages.items():
            self._dep_graph[pkg_id] = set()
            for dep in pkg.requires:
                if dep in self.packages:
                    self._dep_graph[pkg_id].add(dep)
                else:
                    logger.warning(f"Package {pkg_id} requires unknown package {dep}")

        # Build reverse dependency graph: packages that depend on each package
        self._reverse_graph: Dict[str, Set[str]] = {
            pkg_id: set() for pkg_id in self.packages
        }
        for pkg_id, deps in self._dep_graph.items():
            for dep in deps:
                self._reverse_graph[dep].add(pkg_id)

    def _topological_sort(self) -> List[str]:
        """
        Perform topological sort using Kahn's algorithm.

        Returns:
            List of package IDs in dependency order

        Raises:
            CircularDependencyError: If circular dependencies exist
        """
        # Calculate in-degree for each package
        in_degree = {pkg_id: 0 for pkg_id in self._dep_graph}
        for pkg_id, deps in self._dep_graph.items():
            for dep in deps:
                if dep in in_degree:
                    in_degree[dep] += 1

        # Start with packages that have no dependencies
        queue = [pkg_id for pkg_id, degree in in_degree.items() if degree == 0]
        result = []

        while queue:
            # Sort queue for deterministic ordering
            queue.sort()
            pkg_id = queue.pop(0)
            result.append(pkg_id)

            # Update in-degree for packages that depend on this one
            # Use reverse graph: packages that have pkg_id as a dependency
            for dependent in self._reverse_graph.get(pkg_id, set()):
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)

        # Check for cycles
        if len(result) != len(self._dep_graph):
            remaining = set(self._dep_graph.keys()) - set(result)
            raise CircularDependencyError(
                f"Circular dependency detected involving: {remaining}"
            )

        return result

    def resolve(
        self,
        requested_packages: List[str],
        include_optional: bool = False,
    ) -> List[str]:
        """
        Resolve dependencies and return packages in installation order.

        Args:
            requested_packages: List of package IDs to install
            include_optional: Whether to include recommended packages

        Returns:
            List of package IDs in dependency resolution order

        Raises:
            MissingDependencyError: If a required dependency is missing
            ConflictError: If conflicting packages are detected
        """
        # Build the set of packages to resolve
        packages_to_resolve = set(requested_packages)

        # Add required dependencies
        for pkg_id in list(packages_to_resolve):
            if pkg_id in self.packages:
                pkg = self.packages[pkg_id]
                packages_to_resolve.update(pkg.requires)

                if include_optional:
                    for dep in pkg.dependencies.get("recommends", []):
                        if dep in self.packages:
                            packages_to_resolve.add(dep)

        # Check for conflicts
        self._check_conflicts(packages_to_resolve)

        # Build subgraph for requested packages
        resolved_packages = {}
        for pkg_id in packages_to_resolve:
            if pkg_id in self.packages:
                resolved_packages[pkg_id] = self.packages[pkg_id]

        # Create resolver for subgraph and sort
        resolver = DependencyResolver(resolved_packages)

        try:
            return resolver._topological_sort()
        except CircularDependencyError as e:
            raise CircularDependencyError(f"Cannot resolve dependencies: {str(e)}")

    def _check_conflicts(self, packages: Set[str]) -> None:
        """Check for conflicting packages."""
        for pkg_id in packages:
            if pkg_id not in self.packages:
                continue

            pkg = self.packages[pkg_id]
            conflicts = set(pkg.conflicts) & packages
            if conflicts:
                raise ConflictError(f"Package {pkg_id} conflicts with: {conflicts}")

    def get_install_order(self, package_id: str) -> List[str]:
        """
        Get installation order for a single package and its dependencies.

        Args:
            package_id: Package to get order for

        Returns:
            List of packages in installation order
        """
        return self.resolve([package_id])


async def resolve_dependencies(
    package_ids: List[str],
    packages_metadata: Optional[Dict[str, PackageMetadata]] = None,
) -> List[str]:
    """
    Resolve package dependencies asynchronously.

    Args:
        package_ids: List of package IDs to resolve
        packages_metadata: Optional metadata (would normally fetch from DB)

    Returns:
        List of package IDs in installation order
    """
    if packages_metadata is None:
        packages_metadata = {}

    resolver = DependencyResolver(packages_metadata)
    return resolver.resolve(package_ids)


def parse_package_metadata(package_data: Dict[str, Any]) -> PackageMetadata:
    """Parse package metadata from dictionary."""
    return PackageMetadata(
        package_id=package_data.get("id", ""),
        name=package_data.get("name", ""),
        version=package_data.get("version", ""),
        requires=package_data.get("requires", []),
        conflicts=package_data.get("conflicts", []),
        replaces=package_data.get("replaces", []),
        provides=package_data.get("provides", []),
        dependencies=package_data.get("dependencies", {}),
    )


def build_dependency_tree(
    packages: Dict[str, PackageMetadata],
    root_package: str,
) -> Dict[str, Any]:
    """
    Build a dependency tree for visualization.

    Args:
        packages: Available packages
        root_package: Root package to build tree from

    Returns:
        Nested dictionary representing dependency tree
    """

    def _build_node(pkg_id: str, visited: Set[str]) -> Dict[str, Any]:
        if pkg_id in visited:
            return {"circular": True, "package": pkg_id}

        visited.add(pkg_id)

        if pkg_id not in packages:
            return {"missing": True, "package": pkg_id}

        pkg = packages[pkg_id]
        return {
            "package": pkg_id,
            "version": pkg.version,
            "dependencies": [_build_node(dep, visited.copy()) for dep in pkg.requires],
        }

    return _build_node(root_package, set())
