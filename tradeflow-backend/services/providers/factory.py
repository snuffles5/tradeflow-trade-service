from services.providers.yahoo_provider import YahooPriceProvider


class PriceProviderFactory:
    @staticmethod
    def get_provider(provider_name="yahoo"):
        """
        Return an instance of the requested price provider.
        """
        if provider_name.lower() == "yahoo":
            return YahooPriceProvider()
        # elif provider_name.lower() == "other":
        #     return SomeOtherProvider()
        else:
            raise ValueError(f"Unknown provider: {provider_name}")
